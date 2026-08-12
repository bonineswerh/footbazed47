revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant select on table public.matches, public.players to anon, authenticated;
grant select on table public.users to anon, authenticated;
grant insert (id, username, display_name, avatar_url, bio, favorite_teams, is_public) on table public.users to authenticated;
grant update (username, display_name, avatar_url, bio, favorite_teams, is_public, last_seen) on table public.users to authenticated;

grant select, insert, update, delete on table public.ratings, public.player_ratings to authenticated;
grant select on table public.ratings, public.player_ratings to anon;
grant select, insert, update, delete on table public.predictions, public.friendships to authenticated;
grant select on table public.rating_likes, public.rating_comments to anon, authenticated;
grant insert, delete on table public.rating_likes to authenticated;
grant insert, update, delete on table public.rating_comments to authenticated;
grant select on table public.notifications to authenticated;
grant insert, update, delete on table public.notifications to authenticated;
grant select on table public.chat_messages to anon, authenticated;
grant insert on table public.chat_messages to authenticated;
grant select on table public.referee_ratings to anon, authenticated;

grant usage, select on sequence public.ratings_id_seq, public.player_ratings_id_seq,
  public.predictions_id_seq, public.friendships_id_seq, public.rating_likes_id_seq,
  public.notifications_id_seq, public.chat_messages_id_seq, public.rating_comments_id_seq
to authenticated;

revoke all on function public.normalize_new_user_profile() from public, anon, authenticated;
revoke all on function public.protect_user_profile_fields() from public, anon, authenticated;
revoke all on function public.refresh_user_rating_stats() from public, anon, authenticated;
revoke all on function public.record_rating_streak() from public, anon;
grant execute on function public.record_rating_streak() to authenticated;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
revoke all on function public.resolve_invite_code(text) from public, anon;
grant execute on function public.resolve_invite_code(text) to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

notify pgrst, 'reload schema';
