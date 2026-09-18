-- Expose assets to the authenticated Data API while keeping RLS as the authorization layer.
grant select, insert, update, delete on table public.assets to authenticated;
revoke all on table public.assets from anon;
