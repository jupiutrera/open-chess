-- 1. Last write wins on the server too: an upsert carrying an older updated_at
--    than the stored row is ignored instead of overwriting newer data.
-- 2. Pull by a monotonic sequence instead of server_ts. now() is the transaction
--    start, so rows written in one batch share a timestamp (and a page boundary
--    could skip some), and a slow transaction could commit behind the cursor.

alter table public.records add column if not exists seq bigserial;

create index if not exists records_pull_seq on public.records (user_id, seq);

create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- keep the newer row
  end if;
  new.server_ts := now();
  new.seq := nextval(pg_get_serial_sequence('public.records', 'seq'));
  return new;
end $$;
