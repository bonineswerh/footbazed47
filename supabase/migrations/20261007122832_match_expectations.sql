-- Expectations are impressions before kickoff, never predicted goals or ratings.
-- Old predictions remain archived; no user data is converted or removed.
create table private.match_expectations (
  user_id uuid not null references public.users(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  expected_rating smallint not null check(expected_rating between 1 and 10),
  supporter_side text not null check(supporter_side in ('home','away','neutral')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,match_id)
);
alter table private.match_expectations enable row level security;
create policy "Owner expectations" on private.match_expectations to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on private.match_expectations from public,anon,authenticated,service_role;
create index match_expectations_match_idx on private.match_expectations(match_id);
create index match_expectations_user_created_idx on private.match_expectations(user_id,created_at desc);

alter table public.matches add column expectations_closed_at timestamptz;
update public.matches set expectations_closed_at=now() where status in ('live','finished') and expectations_closed_at is null;
create function private.close_match_expectations()
returns trigger language plpgsql set search_path='' as $function$
begin
  if tg_op='UPDATE' and old.expectations_closed_at is not null then
    new.expectations_closed_at:=old.expectations_closed_at;
  elsif new.status in ('live','finished') then
    new.expectations_closed_at:=clock_timestamp();
  end if;
  return new;
end
$function$;
revoke all on function private.close_match_expectations() from public,anon,authenticated,service_role;
create trigger close_match_expectations before insert or update on public.matches
  for each row execute function private.close_match_expectations();

create function public.get_match_expectations(p_match_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare result jsonb; fixture public.matches%rowtype;
begin
  if p_match_id is null or p_match_id<=0 then raise exception using errcode='22023',message='invalid_match_id'; end if;
  select * into fixture from public.matches where id=p_match_id;
  if not found then return null; end if;
  with votes as materialized (
    select e.expected_rating,e.supporter_side,r.match_rating
    from private.match_expectations e join public.users u on u.id=e.user_id and u.is_public
    left join private.community_public_match_votes r on r.user_id=e.user_id and r.match_id=e.match_id
    where e.match_id=p_match_id
  ), segments as (
    select key,jsonb_build_object('count',count(v.expected_rating)::integer,
      'average',round(avg(v.expected_rating),2),'paired_count',count(v.match_rating)::integer,
      'paired_expected',round(avg(v.expected_rating) filter(where v.match_rating is not null),2),
      'paired_rating',round(avg(v.match_rating),2),
      'paired_delta',round(avg(v.match_rating-v.expected_rating),2)) value
    from (values('all'),('home'),('neutral'),('away')) s(key)
    left join votes v on s.key='all' or v.supporter_side=s.key group by key
  ) select jsonb_build_object('is_open',fixture.status='scheduled' and fixture.match_date>statement_timestamp() and fixture.expectations_closed_at is null,
    'segments',(select jsonb_object_agg(key,value) from segments),
    'own',(select jsonb_build_object('rating',e.expected_rating,'supporter_side',e.supporter_side,'updated_at',e.updated_at)
      from private.match_expectations e where e.match_id=p_match_id and e.user_id=auth.uid())) into result;
  return result;
end
$function$;
revoke all on function public.get_match_expectations(bigint) from public,anon,authenticated,service_role;
grant execute on function public.get_match_expectations(bigint) to anon,authenticated;

create function public.save_match_expectation(p_match_id bigint,p_rating smallint,p_supporter_side text)
returns jsonb language plpgsql volatile security definer set search_path='' as $function$
declare viewer uuid:=auth.uid(); fixture public.matches%rowtype;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  if p_rating is null or p_rating not between 1 and 10 then raise exception using errcode='22023',message='rating_out_of_range'; end if;
  if p_supporter_side is null or p_supporter_side not in ('home','away','neutral') then raise exception using errcode='22023',message='supporter_side_required'; end if;
  select * into fixture from public.matches where id=p_match_id for share;
  if not found then raise exception using errcode='22023',message='match_not_found'; end if;
  if fixture.status is distinct from 'scheduled' or fixture.match_date<=clock_timestamp() or fixture.expectations_closed_at is not null then
    raise exception using errcode='22023',message='expectation_closed';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('expectation:'||viewer::text,0));
  if exists(select 1 from private.match_expectations where user_id=viewer and match_id=p_match_id and updated_at>clock_timestamp()-interval '1 second')
    or (select count(*) from private.match_expectations where user_id=viewer and created_at>clock_timestamp()-interval '10 minutes')>=50
       and not exists(select 1 from private.match_expectations where user_id=viewer and match_id=p_match_id) then
    raise exception using errcode='22023',message='expectation_rate_limit';
  end if;
  insert into private.match_expectations(user_id,match_id,expected_rating,supporter_side)
    values(viewer,p_match_id,p_rating,p_supporter_side)
    on conflict(user_id,match_id) do update set expected_rating=excluded.expected_rating,supporter_side=excluded.supporter_side,updated_at=clock_timestamp();
  return public.get_match_expectations(p_match_id);
end
$function$;
revoke all on function public.save_match_expectation(bigint,smallint,text) from public,anon,authenticated,service_role;
grant execute on function public.save_match_expectation(bigint,smallint,text) to authenticated;

create function public.delete_match_expectation(p_match_id bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $function$
declare viewer uuid:=auth.uid(); fixture public.matches%rowtype;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  select * into fixture from public.matches where id=p_match_id for share;
  if not found then raise exception using errcode='22023',message='match_not_found'; end if;
  if fixture.status is distinct from 'scheduled' or fixture.match_date<=clock_timestamp() or fixture.expectations_closed_at is not null then
    raise exception using errcode='22023',message='expectation_closed';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('expectation:'||viewer::text,0));
  delete from private.match_expectations where user_id=viewer and match_id=p_match_id;
  return public.get_match_expectations(p_match_id);
end
$function$;
revoke all on function public.delete_match_expectation(bigint) from public,anon,authenticated,service_role;
grant execute on function public.delete_match_expectation(bigint) to authenticated;

alter table public.notifications add column match_id bigint references public.matches(id) on delete cascade;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('friend_request','friend_accepted','like','comment','system','match_ready'));
create index notifications_match_id_idx on public.notifications(match_id);
create unique index notifications_expectation_ready_idx on public.notifications(user_id,match_id) where type='match_ready';
create function private.notify_expected_match_finished()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.status='finished' and old.status is distinct from 'finished' then
    insert into public.notifications(user_id,type,match_id,read)
      select e.user_id,'match_ready',new.id,false from private.match_expectations e where e.match_id=new.id
      on conflict(user_id,match_id) where type='match_ready' do nothing;
  end if;
  return new;
end
$function$;
revoke all on function private.notify_expected_match_finished() from public,anon,authenticated,service_role;
create trigger notify_expected_match_finished after update of status on public.matches
  for each row execute function private.notify_expected_match_finished();

-- Compose the existing RLS reader, preserving pagination, block scope and read boundary.
create function public.get_notifications_page_v2(p_unread_only boolean default false,p_cursor_created_at timestamptz default null,p_cursor_id integer default null,p_limit integer default 20)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare payload jsonb;
begin
  payload:=public.get_notifications_page(p_unread_only,p_cursor_created_at,p_cursor_id,p_limit);
  return jsonb_set(payload,'{items}',coalesce((select jsonb_agg(
    case when item->>'type'='match_ready' then item||jsonb_build_object('match',case when m.id is not null then jsonb_build_object('id',m.id,
      'home_team_name',m.home_team_name,'away_team_name',m.away_team_name,'league_name',m.league_name) end,'target_available',m.id is not null) else item end order by ordinal)
    from jsonb_array_elements(payload->'items') with ordinality rows(item,ordinal)
    left join public.notifications n on n.id=(item->>'id')::integer and n.user_id=auth.uid()
    left join public.matches m on m.id=n.match_id),'[]'::jsonb));
end
$function$;
revoke all on function public.get_notifications_page_v2(boolean,timestamptz,integer,integer) from public,anon,service_role;
grant execute on function public.get_notifications_page_v2(boolean,timestamptz,integer,integer) to authenticated;
notify pgrst,'reload schema';
