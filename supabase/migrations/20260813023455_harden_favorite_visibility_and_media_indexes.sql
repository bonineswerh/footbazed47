revoke select on table public.favorite_clubs from anon;
grant select on table public.favorite_clubs to authenticated;

create index if not exists clubs_logo_asset_id_idx
  on public.clubs (logo_asset_id);
create index if not exists players_photo_asset_id_idx
  on public.players (photo_asset_id);
create index if not exists competitions_logo_asset_id_idx
  on public.competitions (logo_asset_id);
create index if not exists matches_competition_date_idx
  on public.matches (competition_id, match_date desc);
create index if not exists media_assets_verified_by_idx
  on public.media_assets (verified_by);

notify pgrst, 'reload schema';
