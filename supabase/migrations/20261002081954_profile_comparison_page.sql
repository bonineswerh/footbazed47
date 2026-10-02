-- Read-only comparison of permitted public ratings; existing friend RPC stays compatible.
create function public.get_profile_comparison_page(
  p_user_id uuid, p_filters jsonb default '{}'::jsonb,
  p_offset integer default 0, p_limit integer default 12
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  f jsonb := coalesce(p_filters,'{}'::jsonb);
  competition_filter bigint;
  ordering text := coalesce(nullif(f->>'sort',''),'recent');
  page_size integer := least(greatest(coalesce(p_limit,12),1),24);
  page_offset integer := greatest(coalesce(p_offset,0),0);
  target jsonb;
  mine_favorites jsonb;
  their_favorites jsonb;
  result jsonb;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  if p_user_id is null or p_user_id=viewer then raise exception using errcode='22023',message='comparison_user_invalid'; end if;
  if jsonb_typeof(f)<>'object' or ordering not in ('recent','closest','different') or page_offset>10000
    or (nullif(f->>'competition_id','') is not null and f->>'competition_id' !~ '^[1-9][0-9]{0,14}$') then
    raise exception using errcode='22023',message='invalid_comparison_filters';
  end if;
  competition_filter := nullif(f->>'competition_id','')::bigint;
  -- users SELECT policy decides public / owner / accepted friend visibility.
  select jsonb_build_object('id',u.id,'username',u.username,'display_name',u.display_name,'avatar_url',u.avatar_url)
    into target from public.users u where u.id=p_user_id;
  if target is null then return null; end if;
  -- Reuse the existing authorized favorite reader, with no profile internals in this response.
  mine_favorites := public.get_my_favorite_clubs();
  their_favorites := coalesce(public.get_profile_page(p_user_id,1)->'favorite_clubs','[]'::jsonb);
  with visible as materialized (
    select r.user_id,r.match_id,r.match_rating,m.competition_id,m.match_date
    from public.ratings r join public.matches m on m.id=r.match_id
    where r.user_id in (viewer,p_user_id) and r.is_public and m.status='finished'
  ), common_all as materialized (
    select a.match_id,a.match_rating my_score,b.match_rating their_score,
      abs(a.match_rating-b.match_rating) gap,a.competition_id,a.match_date
    from visible a join visible b on b.match_id=a.match_id and b.user_id=p_user_id
    where a.user_id=viewer
  ), common as materialized (
    select * from common_all where competition_filter is null or competition_id=competition_filter
  ), ranked as materialized (
    select c.*,row_number() over(order by
      case when ordering='closest' then c.gap end asc,
      case when ordering='different' then c.gap end desc,c.match_date desc,c.match_id desc) position
    from common c
  ), page as (
    select * from ranked order by position limit page_size offset page_offset
  ), summary as (
    select count(*) total,count(*) filter(where gap=0) exact_matches,
      count(*) filter(where gap<=1) similar_matches,round(avg(gap),1) average_gap,
      round(100.0*count(*) filter(where gap<=1)/nullif(count(*),0),0) similar_percent
    from common
  ), enriched as (
    select p.*,m.home_team_name,m.away_team_name,m.home_club_id,m.away_club_id,m.league_name,m.home_score,m.away_score
    from page p join public.matches m on m.id=p.match_id
  ), player_counts as (
    select pr.user_id,pr.player_id,count(*) votes,round(avg(pr.rating),1) average
    from public.player_ratings pr join visible v on v.user_id=pr.user_id and v.match_id=pr.match_id
    where competition_filter is null or v.competition_id=competition_filter
    group by pr.user_id,pr.player_id having count(*)>=2
  ), common_players as (
    select p.id,p.name,p.team,a.votes my_votes,b.votes their_votes,a.average my_average,b.average their_average,
      case when ma.id is null then null else jsonb_build_object('id',ma.id,'asset_type',ma.asset_type,
        'url',coalesce(ma.storage_url,ma.source_url),'source_provider',ma.source_provider,
        'license_name',ma.license_name,'license_url',ma.license_url,'attribution',ma.attribution,'usage_status',ma.usage_status) end media
    from player_counts a join player_counts b on b.player_id=a.player_id and b.user_id=p_user_id
    join public.players p on p.id=a.player_id
    left join public.media_assets ma on ma.id=p.photo_asset_id and public.is_displayable_media_asset(ma)
    where a.user_id=viewer order by least(a.votes,b.votes) desc,a.votes+b.votes desc,p.id limit 6
  ), tournament_counts as (
    select v.competition_id,count(*) filter(where v.user_id=viewer) my_votes,
      count(*) filter(where v.user_id=p_user_id) their_votes
    from visible v where v.competition_id is not null
      and (competition_filter is null or v.competition_id=competition_filter)
    group by v.competition_id
  ), tournaments as (
    select cp.id,coalesce(cp.short_name,cp.name) name,t.my_votes,t.their_votes
    from tournament_counts t join public.competitions cp on cp.id=t.competition_id
    order by least(t.my_votes,t.their_votes) desc,t.my_votes+t.their_votes desc,cp.id limit 6
  ), favorites as (
    select coalesce(a.club,b.club) club,
      case when a.club is null then 'theirs' when b.club is null then 'mine' else 'both' end side
    from jsonb_array_elements(mine_favorites) a(club) full join jsonb_array_elements(their_favorites) b(club)
      on a.club->>'id'=b.club->>'id'
  )
  select jsonb_build_object(
    'profile',target,'summary',to_jsonb(s),'total',s.total,
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.position) from enriched p),'[]'::jsonb),
    'has_more',page_offset+page_size<s.total,'next_offset',page_offset+page_size,
    'competitions',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
      select distinct cp.id,coalesce(cp.short_name,cp.name) name from common_all c
      join public.competitions cp on cp.id=c.competition_id order by name,cp.id limit 200) x),'[]'::jsonb),
    'favorites',coalesce((select jsonb_agg(x.club||jsonb_build_object('side',x.side) order by x.side,x.club->>'name')
      from (select * from favorites order by side,club->>'name' limit 12) x),'[]'::jsonb),
    'players',coalesce((select jsonb_agg(to_jsonb(x) order by least(x.my_votes,x.their_votes) desc,x.id) from common_players x),'[]'::jsonb),
    'tournaments',coalesce((select jsonb_agg(to_jsonb(x) order by least(x.my_votes,x.their_votes) desc,x.id) from tournaments x),'[]'::jsonb)
  ) into result from summary s;
  return result;
end $$;
revoke all on function public.get_profile_comparison_page(uuid,jsonb,integer,integer) from public,anon;
grant execute on function public.get_profile_comparison_page(uuid,jsonb,integer,integer) to authenticated;
comment on function public.get_profile_comparison_page(uuid,jsonb,integer,integer) is
  'Visible profile comparison: public finished-match ratings only. Exact, within-one and distance are separate; no compatibility score. Bounded pages and interests.';
notify pgrst,'reload schema';
