-- Deploy the historical-lineup reader in the client before enforcing this RPC.
-- Legacy scores can be retained or removed, never silently erased on review edits.
create function public.is_confirmed_or_unchanged_player_rating(p_user uuid,p_match bigint,p_player bigint,p_rating smallint,p_best boolean)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists(select 1 from public.match_player_appearances a
    where a.match_id=p_match and a.player_id=p_player and a.participation in ('starter','substitute'))
  or exists(select 1 from public.player_ratings r where r.user_id=p_user and r.match_id=p_match and r.player_id=p_player
    and r.rating=p_rating and (not coalesce(p_best,false) or coalesce(r.is_best_player,false)))
$function$;
revoke all on function public.is_confirmed_or_unchanged_player_rating(uuid,bigint,bigint,smallint,boolean) from public,anon,authenticated;

create or replace function public.validate_player_rating_roster()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if not public.is_confirmed_or_unchanged_player_rating(new.user_id,new.match_id,new.player_id,new.rating,new.is_best_player) then
    raise exception using errcode='22023',message='player_not_in_match';
  end if;
  return new;
end
$function$;
drop trigger if exists validate_player_rating_roster_trigger on public.player_ratings;
create trigger validate_player_rating_roster_trigger before insert or update on public.player_ratings
for each row execute function public.validate_player_rating_roster();

-- Assert the deployed baseline, then replace only eligibility and persistence.
-- Preserve the auth, comment, supporter-side, integer score and streak contracts.
do $migration$
declare definition text; previous_validation text; replacement_validation text; previous_write text; replacement_write text;
begin
  select pg_get_functiondef('public.save_match_rating(bigint,smallint,text,boolean,jsonb,text)'::regprocedure) into definition;
  previous_validation := $old$  if exists (
    select 1 from jsonb_array_elements(submitted) items(entry)
    where not exists (
      select 1
      from public.matches m
      join public.players p on p.id = (entry ->> 'player_id')::bigint
      where m.id = p_match_id
        and ((p.club_id is not null and p.club_id = any(array[m.home_club_id, m.away_club_id]))
          or lower(btrim(p.team)) = any(array[lower(btrim(m.home_team_name)), lower(btrim(m.away_team_name))]))
    )
  ) then$old$;
  replacement_validation := $new$  perform pg_advisory_xact_lock(hashtextextended('footbazed:rating:'||current_user_id::text||':'||p_match_id::text,0));
  if exists (
    select 1 from jsonb_array_elements(submitted) items(entry)
    where not public.is_confirmed_or_unchanged_player_rating(current_user_id,p_match_id,
      (entry->>'player_id')::bigint,(entry->>'rating')::smallint,coalesce((entry->>'is_best_player')::boolean,false))
  ) then$new$;
  previous_write := $old$  delete from public.player_ratings pr
  where pr.user_id = current_user_id and pr.match_id = p_match_id;

  insert into public.player_ratings (user_id, match_id, player_id, rating, is_best_player)
  select current_user_id, p_match_id, (entry ->> 'player_id')::bigint,
         (entry ->> 'rating')::smallint,
         coalesce((entry ->> 'is_best_player')::boolean, false)
  from jsonb_array_elements(submitted) items(entry);$old$;
  replacement_write := $new$  delete from public.player_ratings pr
  where pr.user_id = current_user_id and pr.match_id = p_match_id
    and not exists(select 1 from jsonb_array_elements(submitted) items(entry) where (entry->>'player_id')::bigint=pr.player_id);

  insert into public.player_ratings (user_id, match_id, player_id, rating, is_best_player)
  select current_user_id, p_match_id, (entry ->> 'player_id')::bigint,
         (entry ->> 'rating')::smallint,
         coalesce((entry ->> 'is_best_player')::boolean, false)
  from jsonb_array_elements(submitted) items(entry)
  on conflict (user_id,match_id,player_id) do update set rating=excluded.rating,is_best_player=excluded.is_best_player;$new$;
  if strpos(definition,previous_validation)=0 or strpos(definition,previous_write)=0 then raise exception 'historical_rating_contract_drift'; end if;
  execute replace(replace(definition,previous_validation,replacement_validation),previous_write,replacement_write);
end
$migration$;
notify pgrst,'reload schema';
