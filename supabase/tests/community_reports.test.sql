begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(45);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('54000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'report'||i||'@example.test',crypt('report-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,5) i;
insert into public.users(id,username,is_public,is_admin)
select ('54000000-0000-0000-0000-00000000000'||i)::uuid,'report_'||i,i<>2,i=5 from generate_series(1,5) i;
insert into public.matches(id,league_name,home_team_name,away_team_name,match_date,status) overriding system value
select 966000+i,'Report League','Report Home','Report Away',now()-interval '1 day','finished' from generate_series(1,8) i;
insert into public.ratings(id,user_id,match_id,match_rating,is_public,comment) overriding system value
select 967000+i,'54000000-0000-0000-0000-000000000003',966000+i,9,i<>2,'Public text '||i from generate_series(1,8) i;
insert into public.ratings(id,user_id,match_id,match_rating,is_public,comment) overriding system value
values(967009,'54000000-0000-0000-0000-000000000002',966001,8,true,'Private profile public rating');
insert into public.rating_comments(id,rating_id,user_id,comment,created_at) overriding system value values
(968001,967001,'54000000-0000-0000-0000-000000000003','Visible comment',now()-interval '2 days'),
(968002,967002,'54000000-0000-0000-0000-000000000003','Private rating comment',now()-interval '1 day');
create temp table report_test_ids(name text primary key,id uuid);
grant select,insert on report_test_ids to authenticated,service_role;
select ok(not has_function_privilege('anon','public.submit_community_report(text,text,text,text)','EXECUTE'),'anonymous report submission is denied');
select ok(not has_function_privilege('authenticated','public.admin_get_community_reports(uuid,text,text,integer,integer)','EXECUTE'),'client cannot read the admin queue');
select ok(not has_function_privilege('authenticated','public.admin_review_community_report(uuid,uuid,text,text)','EXECUTE'),'client cannot resolve reports');
select ok(not has_table_privilege('authenticated','public.community_reports','INSERT'),'direct report insert is denied');
select ok(not has_column_privilege('authenticated','public.community_reports','snapshot','SELECT'),'reporter cannot read snapshots');
select ok(not has_column_privilege('authenticated','public.community_reports','reviewed_by','SELECT'),'staff identity stays private');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select public.submit_community_report('rating','967001','spam')$$,'42501',null,'anonymous cannot submit');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.submit_community_report('rating','967001','spam')$$,'42501','auth_required','missing identity cannot submit');
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.submit_community_report('rating','967002','spam')$$,'42501','report_target_unavailable','private review cannot be reported or probed');
select throws_ok($$select public.submit_community_report('rating','967009','spam')$$,'42501','report_target_unavailable','stranger cannot report hidden-profile review');
select throws_ok($$select public.submit_community_report('comment','968002','spam')$$,'42501','report_target_unavailable','comment on private rating is hidden');
select throws_ok($$select public.submit_community_report('profile','54000000-0000-0000-0000-000000000002','spam')$$,'42501','report_target_unavailable','private stranger profile is hidden');
select throws_ok($$select public.submit_community_report('profile','54000000-0000-0000-0000-000000000001','spam')$$,'42501','report_target_unavailable','cannot report own profile');
select throws_ok($$select public.submit_community_report('rating','1 OR 1=1','spam')$$,'22023','invalid_report_target','target is data, not SQL');
select throws_ok($$select public.submit_community_report('rating','9999999999','spam')$$,'22023','invalid_report_target','integer overflow is rejected safely');
select throws_ok($$select public.submit_community_report('profile','not-a-uuid','spam')$$,'22023','invalid_report_target','invalid profile identity is rejected');
select throws_ok($$select public.submit_community_report('rating','967001','forged')$$,'22023','invalid_report','reason allowlist is enforced');
select throws_ok($$select public.submit_community_report('rating','967001','spam',repeat('x',1001))$$,'22023','invalid_report','details are bounded');
insert into report_test_ids select 'review',(public.submit_community_report('rating','967001','spam','  Visible report  ')->>'id')::uuid;
select is(public.submit_community_report('rating','967001','other')->>'duplicate','true','duplicate pending report is idempotent');
select is((select count(*)::integer from public.community_reports),1,'duplicate does not add another report');
select is((select details from public.community_reports where id=(select id from report_test_ids where name='review')),'Visible report','details are trimmed');
select throws_ok($$update public.community_reports set status='dismissed' where id=(select id from report_test_ids where name='review')$$,'42501',null,'reporter cannot resolve own report');
insert into report_test_ids select 'comment',(public.submit_community_report('comment','968001','harassment')->>'id')::uuid;
insert into report_test_ids select 'profile',(public.submit_community_report('profile','54000000-0000-0000-0000-000000000003','impersonation')->>'id')::uuid;
reset role;
select is((select reporter_id from public.community_reports where id=(select id from report_test_ids where name='review')),'54000000-0000-0000-0000-000000000001'::uuid,'actor comes from auth, not a submitted identity');
select ok(not (select snapshot from public.community_reports where id=(select id from report_test_ids where name='review')) ?| array['email','invite_code','is_admin','match_rating'],'snapshot excludes sensitive identity and private rating fields');
insert into public.friendships(user_id,friend_id,status) values('54000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000002','accepted');
set local role authenticated;
select lives_ok($$select public.submit_community_report('profile','54000000-0000-0000-0000-000000000002','other')$$,'accepted friend can report a visible private profile');
select lives_ok($$select public.submit_community_report('rating','967009','other')$$,'accepted friend can report its public review');
select throws_ok($$select public.submit_community_report('rating','967003','spam')$$,'P0001','report_rate_limit','five reports per ten minutes prevents flooding');
select is(public.submit_community_report('rating','967001','spam')->>'duplicate','true','retry remains safe even at the rate limit');
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(id)::integer from public.community_reports),0,'another user cannot read reporter history');
insert into report_test_ids select 'other',(public.submit_community_report('rating','967003','spam')->>'id')::uuid;
select is((select count(id)::integer from public.community_reports),1,'RLS exposes only the current reporter own history');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.admin_get_community_reports('54000000-0000-0000-0000-000000000001')$$,'42501','admin_required','SQL rechecks privileged actor even behind service API');
select is((public.admin_get_community_reports('54000000-0000-0000-0000-000000000005','open','all',0,1)->>'total')::integer,6,'queue count covers the entire filtered history');
select is(jsonb_array_length(public.admin_get_community_reports('54000000-0000-0000-0000-000000000005','open','all',0,1)->'items'),1,'queue page is bounded');
select is(public.admin_get_community_reports('54000000-0000-0000-0000-000000000005','open','all',0,1)->>'has_more','true','queue exposes next-page state');
select is((public.admin_get_community_reports('54000000-0000-0000-0000-000000000005','open','profile')->>'total')::integer,2,'target filter uses the exact target type');
select throws_ok($$select public.admin_review_community_report('54000000-0000-0000-0000-000000000005',(select id from report_test_ids where name='review'),'dismissed','short')$$,'22023','invalid_report_decision','review requires a useful reason');
select lives_ok($$select public.admin_review_community_report('54000000-0000-0000-0000-000000000005',(select id from report_test_ids where name='review'),'dismissed','No violation in this review.')$$,'admin can resolve a report');
select is(public.admin_review_community_report('54000000-0000-0000-0000-000000000005',(select id from report_test_ids where name='review'),'reviewed','Different second decision.')->>'status','dismissed','a repeated decision cannot overwrite the first');
select is((select count(*)::integer from public.admin_audit_logs where target_id=(select id::text from report_test_ids where name='review')),1,'decision has exactly one audit append');
select throws_ok($$update public.admin_audit_logs set action='forged' where target_id=(select id::text from report_test_ids where name='review')$$,'42501',null,'service cannot rewrite audit history');
reset role;
-- An audit failure must leave the report pending; do not silently accept an unaudited decision.
create function pg_temp.reject_report_audit() returns trigger language plpgsql as $$begin raise exception 'audit_test_failure'; end$$;
create trigger test_report_audit_failure before insert on public.admin_audit_logs for each row execute function pg_temp.reject_report_audit();
set local role service_role;
select throws_ok($$select public.admin_review_community_report('54000000-0000-0000-0000-000000000005',(select id from report_test_ids where name='comment'),'reviewed','A considered report decision.')$$,'P0001','audit_test_failure','audit failure rolls back the entire decision');
select is((select status from public.community_reports where id=(select id from report_test_ids where name='comment')),'open','failed audit preserves pending report');
reset role;
drop trigger test_report_audit_failure on public.admin_audit_logs;
update public.community_reports set created_at=now()-interval '15 minutes' where reporter_id='54000000-0000-0000-0000-000000000001';
insert into public.community_reports(reporter_id,subject_id,target_type,target_id,reason,snapshot,status,created_at,reviewed_at,reviewed_by,decision_note)
select '54000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000003','rating',(967000+i)::text,'spam','{}','dismissed',now()-interval '15 minutes',now(),'54000000-0000-0000-0000-000000000005','Historical decision.' from generate_series(1,15) i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.submit_community_report('rating','967004','spam')$$,'P0001','report_rate_limit','daily cap remains enforced when short window expires');
reset role;
delete from public.rating_comments where id=968001;
select is((select count(*)::integer from public.community_reports where id=(select id from report_test_ids where name='comment')),1,'source deletion preserves the report for review');
select is((select count(*)::integer from public.ratings where id between 967001 and 967009),9,'report handling never deletes ratings');
select * from finish();
rollback;
