-- A re-push of a row the server already holds (same updated_at, e.g. after a backup
-- restore resets the push cursor) is ignored instead of taking a new seq, which made
-- every other device pull it again. Clients stamp merges they push back with a
-- timestamp newer than both copies, so those still apply.
-- search_path is pinned so the trigger can't be redirected by a caller's path.

create or replace function public.records_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null; -- keep the stored row
  end if;
  new.server_ts := now();
  new.seq := nextval(pg_get_serial_sequence('public.records', 'seq'));
  return new;
end $$;
