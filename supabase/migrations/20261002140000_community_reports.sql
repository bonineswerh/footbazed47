-- Additive moderation intake. Existing football data and visibility are unchanged.
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('rating','comment','profile')),
  target_id text not null check (char_length(target_id) between 1 and 36),
  reason text not null check (reason in ('harassment','hate','spam','impersonation','other')),
  details text not null default '' check (char_length(details) <= 1000),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  constraint community_reports_review_state check (
    (status='open' and reviewed_at is null and reviewed_by is null and decision_note='')
    or (status<>'open' and reviewed_at is not null and char_length(decision_note) >= 10)
  )
);
create unique index community_reports_one_open_idx on public.community_reports(reporter_id,target_type,target_id) where status='open';
create index community_reports_reporter_created_idx on public.community_reports(reporter_id,created_at desc);
create index community_reports_subject_idx on public.community_reports(subject_id);
create index community_reports_reviewer_idx on public.community_reports(reviewed_by);
create index community_reports_queue_idx on public.community_reports(status,created_at,id);
create index community_reports_target_queue_idx on public.community_reports(target_type,status,created_at,id);
alter table public.community_reports enable row level security;
create policy community_reports_read_own on public.community_reports for select to authenticated using (reporter_id=(select auth.uid()));
revoke all on public.community_reports from public,anon,authenticated,service_role;
grant select(id,target_type,target_id,reason,details,status,created_at,reviewed_at,decision_note) on public.community_reports to authenticated;
grant select on public.community_reports to service_role;
comment on table public.community_reports is 'Private moderation intake. Only the reporter can read limited own status; snapshots and staff identity are service-only. No client table writes.';

create function public.submit_community_report(p_target_type text,p_target_id text,p_reason text,p_details text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  subject uuid;
  target text := btrim(coalesce(p_target_id,''));
  details text := btrim(coalesce(p_details,''));
  target_number integer;
  target_user uuid;
  captured jsonb;
  existing public.community_reports;
  saved public.community_reports;
begin
  if actor is null or not exists(select 1 from public.users where id=actor) then
    raise exception using errcode='42501',message='auth_required';
  end if;
  if p_target_type is null or p_target_type not in ('rating','comment','profile')
     or p_reason is null or p_reason not in ('harassment','hate','spam','impersonation','other')
     or char_length(details)>1000 then
    raise exception using errcode='22023',message='invalid_report';
  end if;
  if p_target_type='profile' then
    if target !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    target_user:=target::uuid; target:=target_user::text;
    select u.id,jsonb_build_object('username',u.username,'label',coalesce(u.display_name,u.username),'text',left(coalesce(u.bio,''),1000))
      into subject,captured from public.users u
      where u.id=target_user and (u.is_public or public.is_user_visible(u.id));
  else
    if target !~ '^[1-9][0-9]{0,9}$' then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    if target::bigint>2147483647 then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    target_number:=target::integer; target:=target_number::text;
    if p_target_type='rating' then
      select r.user_id,jsonb_build_object('username',u.username,'label',concat_ws(' — ',m.home_team_name,m.away_team_name),'text',left(coalesce(r.comment,''),1000),'match_id',r.match_id)
        into subject,captured from public.ratings r join public.users u on u.id=r.user_id join public.matches m on m.id=r.match_id
        where r.id=target_number and r.is_public and (u.is_public or public.is_user_visible(u.id));
    else
      -- A comment's existing reader exposes it on public ratings, independently of profile visibility.
      select rc.user_id,jsonb_build_object('username',u.username,'label','Комментарий к оценке матча','text',left(rc.comment,1000),'match_id',r.match_id)
        into subject,captured from public.rating_comments rc join public.ratings r on r.id=rc.rating_id join public.users u on u.id=rc.user_id
        where rc.id=target_number and r.is_public;
    end if;
  end if;
  if subject is null or subject=actor then
    raise exception using errcode='42501',message='report_target_unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('community-report:'||actor::text,0));
  select * into existing from public.community_reports where reporter_id=actor and target_type=p_target_type and target_id=target and status='open';
  if found then
    return jsonb_build_object('id',existing.id,'status',existing.status,'duplicate',true);
  end if;
  if (select count(*) from public.community_reports where reporter_id=actor and created_at>now()-interval '10 minutes')>=5
     or (select count(*) from public.community_reports where reporter_id=actor and created_at>now()-interval '1 day')>=20 then
    raise exception using errcode='P0001',message='report_rate_limit';
  end if;
  insert into public.community_reports(reporter_id,subject_id,target_type,target_id,reason,details,snapshot)
    values(actor,subject,p_target_type,target,p_reason,details,captured) returning * into saved;
  return jsonb_build_object('id',saved.id,'status',saved.status,'duplicate',false);
end;
$$;
revoke all on function public.submit_community_report(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_community_report(text,text,text,text) to authenticated;

create function public.admin_get_community_reports(p_actor uuid,p_status text default 'open',p_target_type text default 'all',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  cap integer := greatest(1,least(coalesce(p_limit,20),40));
  skip integer := greatest(0,least(coalesce(p_offset,0),1000000));
  result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from public.users where id=p_actor and is_admin) then
    raise exception using errcode='42501',message='admin_required';
  end if;
  if p_status is null or p_status not in ('all','open','reviewed','dismissed') or p_target_type is null or p_target_type not in ('all','rating','comment','profile') then
    raise exception using errcode='22023',message='invalid_report_filters';
  end if;
  with filtered as materialized (
    select r.id,r.created_at from public.community_reports r where (p_status='all' or r.status=p_status) and (p_target_type='all' or r.target_type=p_target_type)
  ), page as (
    select r.* from (select id from filtered order by created_at,id limit cap offset skip) ids
      join public.community_reports r on r.id=ids.id
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'target_type',r.target_type,'target_id',r.target_id,'reason',r.reason,'details',r.details,'snapshot',r.snapshot,
    'status',r.status,'created_at',r.created_at,'reviewed_at',r.reviewed_at,'decision_note',r.decision_note,
    'reporter',jsonb_build_object('username',u.username),'subject_id',r.subject_id
  ) order by r.created_at,r.id) from page r left join public.users u on u.id=r.reporter_id),'[]'::jsonb),
    'total',(select count(*) from filtered),'offset',skip,'has_more',skip+cap<(select count(*) from filtered),
    'counts',(select jsonb_build_object('open',count(*) filter(where status='open'),'reviewed',count(*) filter(where status='reviewed'),'dismissed',count(*) filter(where status='dismissed')) from public.community_reports)) into result;
  return result;
end;
$$;
revoke all on function public.admin_get_community_reports(uuid,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_get_community_reports(uuid,text,text,integer,integer) to service_role;

create function public.admin_review_community_report(p_actor uuid,p_report_id uuid,p_status text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  report public.community_reports;
  note text := btrim(coalesce(p_note,''));
begin
  if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from public.users where id=p_actor and is_admin) then
    raise exception using errcode='42501',message='admin_required';
  end if;
  if p_status is null or p_status not in ('reviewed','dismissed') or char_length(note) not between 10 and 1000 then
    raise exception using errcode='22023',message='invalid_report_decision';
  end if;
  select * into report from public.community_reports where id=p_report_id for update;
  if not found then raise exception using errcode='P0002',message='report_not_found'; end if;
  if report.status<>'open' then
    return jsonb_build_object('id',report.id,'status',report.status,'already_reviewed',true);
  end if;
  update public.community_reports set status=p_status,decision_note=note,reviewed_by=p_actor,reviewed_at=now() where id=report.id;
  -- The decision and immutable audit append commit together. Audit failure rolls back the decision.
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
    values(p_actor,'moderation.report_review','community_report',report.id::text,
      jsonb_build_object('status',p_status,'note',note,'target_type',report.target_type,'target_id',report.target_id));
  return jsonb_build_object('id',report.id,'status',p_status,'already_reviewed',false);
end;
$$;
revoke all on function public.admin_review_community_report(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_review_community_report(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
