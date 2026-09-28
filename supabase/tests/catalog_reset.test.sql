begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(16);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('14000000-0000-0000-0000-000000000001','authenticated','authenticated','reset-owner@example.test','{}','{}',now(),now()),
('14000000-0000-0000-0000-000000000002','authenticated','authenticated','reset-friend@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_public) values
('14000000-0000-0000-0000-000000000001','reset_owner',true),('14000000-0000-0000-0000-000000000002','reset_friend',true);
insert into public.clubs(id,name) overriding system value values(970001,'Reset Home'),(970002,'Русский дубль');
insert into public.favorite_clubs(user_id,club_id) values('14000000-0000-0000-0000-000000000001',970001);
insert into public.matches(id,home_team_name,away_team_name,league_name,match_date,status,home_club_id)
overriding system value values(970001,'Reset Home','Old Away','Old League',now(),'finished',970001);
insert into public.players(id,name,team,club_id) overriding system value values(970001,'Old Player','Reset Home',970001);
insert into public.ratings(user_id,match_id,match_rating,is_public,supporter_side)
values('14000000-0000-0000-0000-000000000001',970001,9,true,'neutral');
insert into public.direct_conversations(id,user_a,user_b) overriding system value
values(970001,'14000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002');
insert into public.direct_messages(conversation_id,sender_id,media_kind,rating_id)
select 970001,'14000000-0000-0000-0000-000000000001','rating',id from public.ratings where match_id=970001;

set local role anon;
select ok(not has_function_privilege('anon','public.admin_stage_catalog(uuid,text,jsonb)','execute'),'anonymous callers cannot stage data');
select ok(not has_schema_privilege('anon','private','usage'),'backup schema is not readable by anonymous callers');
set local role authenticated;
select ok(not has_function_privilege('authenticated','public.admin_apply_prepared_catalog(uuid,text)','execute'),'ordinary users cannot replace the catalogue');
reset role;

create temporary table reset_result(data jsonb);
grant all on reset_result to service_role;
set local role service_role;
select throws_ok($$select public.admin_cleanup_development_data('all','DELETE FOOTBAZED DATA')$$,'22023','complete_catalog_required','reset fails before deletion without a complete staged catalogue');
select is((select count(*)::integer from public.matches where id=970001),1,'failed preparation preserves existing data');
select throws_ok($$select public.admin_cleanup_development_data('ratings','yes')$$,'22023','confirmation_required','exact confirmation remains required');
do $$ declare league text; n integer:=0; payload jsonb; begin
  foreach league in array array['PL','PD','BL1','SA','FL1','CL'] loop
    n:=n+1;
    payload:=jsonb_build_object('from','2026-09-01','to','2026-10-10',
      'competition',jsonb_build_object('code',league,'name','Reset '||league,'competition_type','LEAGUE'),
      'clubs',jsonb_build_array(jsonb_build_object('external_id',870001,'name','Reset Home','short_name','Home','club_colors','Blue / White'),jsonb_build_object('external_id',870002,'name','Reset Away','short_name','Away','club_colors','Red')),
      'players',jsonb_build_array(jsonb_build_object('name','New Player','external_club_id',870001,'position','GK','metadata',jsonb_build_object('external_id',1001))),
      'matches',jsonb_build_array(jsonb_build_object('external_id',870000+n,'home_external_id',870001,'away_external_id',870002,'match_date','2026-09-20T19:00:00Z','status','finished','home_score',2,'away_score',1)));
    perform public.admin_stage_catalog('14000000-0000-4000-8000-000000000001',league,payload);
  end loop;
end $$;
insert into reset_result select public.admin_apply_prepared_catalog('14000000-0000-4000-8000-000000000001','DELETE FOOTBAZED DATA');
select is((select count(*)::integer from public.clubs),2,'legacy clubs and duplicate names are replaced');
select is((select count(*)::integer from public.matches),6,'all six staged tournaments load atomically');
select is((select count(*)::integer from public.ratings),0,'all ratings are cleared');
select is((select count(*)::integer from public.players),1,'repeated squad records across tournaments are deduplicated');
select is((select count(*)::integer from public.favorite_clubs f join public.clubs c on c.id=f.club_id where c.name='Reset Home'),1,'favorite club identity survives new row IDs');
select is((select count(*)::integer from public.users where id in ('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002')),2,'accounts survive catalogue replacement');
select is((select count(*)::integer from public.direct_messages where conversation_id=970001 and body is not null and rating_id is null),1,'shared rating message remains readable after deletion');
select is((select ratings_count::integer from public.users where id='14000000-0000-0000-0000-000000000001'),0,'managed counters reset with the ratings');
select is((select jsonb_array_length(snapshot->'ratings') from private.football_backups where id=(select (data->>'backup_id')::uuid from reset_result)),1,'backup contains the original ratings');
reset role;
-- Exercise the recovery format on this disposable database, never production.
do $$ declare snap jsonb; name text; begin
  select snapshot into snap from private.football_backups where id=(select (data->>'backup_id')::uuid from reset_result);
  delete from public.matches;delete from public.players;delete from public.clubs;delete from public.competitions;
  foreach name in array array['competitions','clubs','club_aliases','club_competitions','favorite_clubs','players','matches','ratings','player_ratings','rating_likes','rating_comments','predictions','chat_messages','live_chat_messages','referee_ratings','rating_activity_days','notifications'] loop
    execute format('insert into public.%I overriding system value select * from jsonb_populate_recordset(null::public.%I,$1) on conflict do nothing',name,name) using snap->name;
  end loop;
  update public.direct_messages m set rating_id=x.rating_id,body=x.body from jsonb_to_recordset(snap->'direct_message_links') x(id bigint,rating_id bigint,body text) where m.id=x.id;
end $$;
select is((select count(*)::integer from public.direct_messages m join public.ratings r on r.id=m.rating_id join public.matches g on g.id=r.match_id where g.id=970001),1,'backup restores the original football graph and shared-message reference');
select * from finish();
rollback;
