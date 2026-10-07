begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('71000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'discovery'||i||'@example.test',crypt('discovery-test',gen_salt('bf')),now(),'{}','{}',now(),now() from generate_series(1,7)i;
insert into public.users(id,username,is_public,is_admin)
select ('71000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'discovery_'||i,i<>6,i=1 from generate_series(1,7)i;
insert into public.friendships(user_id,friend_id,status)
select ('71000000-0000-0000-0000-'||lpad(a::text,12,'0'))::uuid,('71000000-0000-0000-0000-'||lpad(b::text,12,'0'))::uuid,s
from(values(1,2,'accepted'),(3,2,'accepted'),(2,4,'accepted'),(2,5,'accepted'),(2,6,'accepted'),(1,5,'pending'),(1,7,'accepted'),(7,3,'accepted'))v(a,b,s);
insert into public.competitions(id,name,code) overriding system value values(971001,'Discovery League','DISC');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,match_date,status) overriding system value values(972001,971001,'Discovery League','Home','Away',now()-interval '1 day','finished');
insert into public.ratings(user_id,match_id,match_rating,is_public)
select ('71000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,972001,9,i<>4 from generate_series(2,6)i;
select ok(not has_table_privilege('authenticated','private.community_experts','SELECT'),'editorial registry has no client table grant');
select ok(not has_table_privilege('authenticated','private.community_experts','INSERT'),'user cannot appoint experts');
select ok(not has_function_privilege('authenticated','public.admin_community_experts(uuid,text,boolean)','EXECUTE'),'expert management is service-only');
select ok(not has_function_privilege('anon','public.get_community_suggestions(integer,integer)','EXECUTE'),'anonymous graph reader is denied');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.admin_community_experts('71000000-0000-0000-0000-000000000002')$$,'42501','admin_required','non-admin actor rejected even for service caller');
select throws_ok($$select public.admin_community_experts('71000000-0000-0000-0000-000000000001','missing_username',true)$$,'22023','expert_user_not_found','unknown user is not invented');
select is(jsonb_array_length(public.admin_community_experts('71000000-0000-0000-0000-000000000001','discovery_3',true)->'items'),1,'admin assigns exact account');
select is(jsonb_array_length(public.admin_community_experts('71000000-0000-0000-0000-000000000001','DISCOVERY_3',true)->'items'),1,'repeated assignment idempotent');
select public.admin_community_experts('71000000-0000-0000-0000-000000000001','discovery_4',true);
select public.admin_community_experts('71000000-0000-0000-0000-000000000001','discovery_6',true);
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is(jsonb_array_length(public.get_social_feed_page('experts')->'items'),1,'expert feed excludes private vote and private profile before paging');
select is(public.get_social_feed_page('experts')#>>'{items,0,user,is_expert}','true','expert label comes from protected registry');
select is(public.get_social_feed_page('experts')#>>'{items,0,user,username}','discovery_3','ordinary authors are not substituted');
select ok(not (public.get_social_feed_page('experts')#>'{items,0,user}') ?| array['email','is_admin','assigned_by'],'expert payload excludes internal fields');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000001"}',true);
select is(jsonb_array_length(public.get_community_suggestions()->'items'),2,'only unconnected public friends of friends are suggested');
select is(public.get_community_suggestions()#>>'{items,0,username}','discovery_3','more mutual friends rank first');
select is((public.get_community_suggestions()#>>'{items,0,mutual_count}')::integer,2,'duplicate directed edges do not inflate mutual count');
select ok(not (public.get_community_suggestions()#>'{items,0}') ?| array['email','mutual_ids','is_admin'],'suggestions reveal only bounded public labels and count');
select is(jsonb_array_length(public.get_community_suggestions(0,1)->'items'),1,'bounded first page');
select is(public.get_community_suggestions(0,1)->>'has_more','true','next page is indicated');
select is(public.get_community_suggestions(1,1)#>>'{items,0,username}','discovery_4','pagination continues after graph filtering');
select public.set_user_block('71000000-0000-0000-0000-000000000003',true);
select is(jsonb_array_length(public.get_community_suggestions()->'items'),1,'outgoing block hides suggested person');
select is(jsonb_array_length(public.get_social_feed_page('experts')->'items'),0,'outgoing block hides expert reviews');
select public.set_user_block('71000000-0000-0000-0000-000000000003',false);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000004"}',true);
select public.set_user_block('71000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000001"}',true);
select is(jsonb_array_length(public.get_community_suggestions()->'items'),1,'incoming block is respected');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.get_community_suggestions()$$,'42501','auth_required','missing JWT identity rejected');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_community_experts('71000000-0000-0000-0000-000000000001','discovery_3',false);
reset role;
select ok(not exists(select 1 from private.community_experts where user_id='71000000-0000-0000-0000-000000000003'),'role can be revoked');
select is((select count(*)::integer from public.ratings where user_id='71000000-0000-0000-0000-000000000003'),1,'revoking role preserves ratings');
select is((select count(*)::integer from public.admin_audit_logs where action='set_community_expert' and actor_id='71000000-0000-0000-0000-000000000001'),5,'role assignments and removal are audited atomically');
select * from finish();
rollback;
