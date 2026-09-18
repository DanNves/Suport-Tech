-- Data API access for authenticated users; RLS keeps write operations admin-only.
grant select, insert, update, delete on table public.departments to authenticated;
revoke all on table public.departments from anon;
