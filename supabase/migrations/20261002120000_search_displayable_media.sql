-- Compatible successor: preserve the ranked search reader and enrich only its
-- bounded results, under caller RLS, with already displayable football media.
create function public.search_footbazed_v2(p_query text,p_limit integer default 14)
returns jsonb language sql stable security invoker set search_path='' as $function$
  with results as materialized (
    select * from public.search_footbazed(p_query,least(greatest(coalesce(p_limit,14),1),24))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'entity_type',r.entity_type,'entity_id',r.entity_id,'title',r.title,
    'subtitle',r.subtitle,'meta',r.meta,'relevance',r.relevance,
    'visual',case when r.entity_type in ('club','player','competition') then jsonb_build_object(
      'id',r.entity_id,'name',r.title,'tla',c.tla,
      'primary_color',coalesce(c.primary_color,pc.primary_color),
      'secondary_color',coalesce(c.secondary_color,pc.secondary_color),
      'media',case when ma.id is null then null else jsonb_build_object(
        'id',ma.id,'asset_type',ma.asset_type,'url',coalesce(ma.storage_url,ma.source_url),
        'source_provider',ma.source_provider,'license_name',ma.license_name,
        'license_url',ma.license_url,'attribution',ma.attribution,'usage_status',ma.usage_status
      ) end
    ) else null end
  ) order by r.relevance desc,case r.entity_type when 'club' then 1 when 'competition' then 2 when 'player' then 3 when 'match' then 4 else 5 end,r.title,r.entity_id),'[]'::jsonb)
  from results r
  left join public.clubs c on c.id=case when r.entity_type='club' then r.entity_id::bigint end
  left join public.players p on p.id=case when r.entity_type='player' then r.entity_id::bigint end
  left join public.clubs pc on pc.id=p.club_id
  left join public.competitions cp on cp.id=case when r.entity_type='competition' then r.entity_id::bigint end
  left join public.media_assets ma on ma.id=coalesce(c.logo_asset_id,p.photo_asset_id,cp.logo_asset_id)
    and ma.asset_type=case r.entity_type when 'club' then 'club_logo' when 'player' then 'player_photo' when 'competition' then 'competition_logo' end
    and public.is_displayable_media_asset(ma);
$function$;
revoke all on function public.search_footbazed_v2(text,integer) from public;
grant execute on function public.search_footbazed_v2(text,integer) to anon,authenticated;
notify pgrst,'reload schema';
