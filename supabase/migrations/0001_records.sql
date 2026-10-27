-- One table mirrors every local Dexie table. Rows are owned by the signed-in user.
create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  tbl text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_ts timestamptz not null default now(),
  primary key (user_id, tbl, id)
);

create index if not exists records_pull on public.records (user_id, server_ts);

-- server_ts is the pull cursor, so it must not depend on client clocks
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.server_ts := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
