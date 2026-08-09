revoke insert, update, delete on table public.ratings from authenticated;
revoke insert, update, delete on table public.player_ratings from authenticated;

drop policy if exists "Create own rating" on public.ratings;
drop policy if exists "Update own rating" on public.ratings;
drop policy if exists "Delete own rating" on public.ratings;
drop policy if exists "Create own player rating" on public.player_ratings;
drop policy if exists "Update own player rating" on public.player_ratings;
drop policy if exists "Delete own player rating" on public.player_ratings;

revoke execute on function public.record_rating_streak() from authenticated;

notify pgrst, 'reload schema';
