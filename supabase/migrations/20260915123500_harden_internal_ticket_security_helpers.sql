-- Helper authorization functions are internal implementation details; they should not be exposed as client RPCs.
revoke execute on function public.can_manage_tickets() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.is_support_staff() from public, anon, authenticated;
