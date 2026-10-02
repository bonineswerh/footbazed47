-- Add full visible-history aggregates to the existing bounded profile response.
-- Preserve its authorization, media and old-client payload/grant contracts.
do $migration$
declare
  definition text := replace(pg_get_functiondef('public.get_profile_page(uuid,integer)'::regprocedure),E'\r\n',E'\n');
  declaration_anchor text := '  favorite_clubs_data jsonb;';
  return_anchor text := $old$  return jsonb_build_object('profile', profile_data, 'favorite_clubs', favorite_clubs_data,
    'stats', stats_data, 'friendship', friendship_data, 'ratings', ratings_data);$old$;
  summary_query text := $new$  with visible as materialized (
    select r.match_rating,btrim(coalesce(r.comment,''))<>'' has_review,m.competition_id
    from public.ratings r join public.matches m on m.id=r.match_id
    where r.user_id=p_user_id and (r.is_public=true or p_user_id=current_user_id)
  ), totals as materialized (
    select count(*) total,round(avg(match_rating),1) average,
      count(*) filter(where has_review) reviewed,min(match_rating) minimum,max(match_rating) maximum
    from visible
  ), bins as materialized (
    select match_rating,count(*) votes from visible group by match_rating
  ), tournaments as materialized (
    select v.competition_id,count(*) votes,round(avg(v.match_rating),1) average
    from visible v where v.competition_id is not null group by v.competition_id
  )
  select jsonb_build_object(
    'scope',case when p_user_id=current_user_id then 'own' else 'public' end,
    'total',(select total from totals),
    'average',(select average from totals),
    'reviewed',(select reviewed from totals),
    'minimum',(select minimum from totals),
    'maximum',(select maximum from totals),
    'tournament_count',(select count(*) from tournaments),
    'distribution',(select jsonb_agg(jsonb_build_object('rating',n,'count',coalesce(b.votes,0)) order by n desc)
      from generate_series(1,10) n left join bins b on b.match_rating=n),
    'tournaments',coalesce((select jsonb_agg(to_jsonb(x) order by x.votes desc,x.id) from (
      select c.id,coalesce(c.short_name,c.name) name,t.votes,t.average
      from tournaments t join public.competitions c on c.id=t.competition_id
      order by t.votes desc,c.id limit 6
    ) x),'[]'::jsonb)
  ) into rating_summary_data;

  -- Old clients read these existing fields; give them the same permitted scope.
  -- Do not rewrite stored user counters or expose private averages via this RPC.
  profile_data := profile_data || jsonb_build_object(
    'ratings_count',rating_summary_data->'total',
    'avg_rating',coalesce(rating_summary_data->'average','0'::jsonb));

  return jsonb_build_object('profile', profile_data, 'favorite_clubs', favorite_clubs_data,
    'stats', stats_data, 'friendship', friendship_data, 'ratings', ratings_data,
    'rating_summary',rating_summary_data);$new$;
begin
  if strpos(definition,declaration_anchor)=0 or strpos(definition,return_anchor)=0
     or strpos(definition,'rating_summary_data')>0 then
    raise exception 'profile_summary_contract_drift';
  end if;
  execute replace(replace(definition,declaration_anchor,declaration_anchor||E'\n  rating_summary_data jsonb;'),return_anchor,summary_query);
end
$migration$;
notify pgrst,'reload schema';
