begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(18);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values('15000000-0000-0000-0000-000000000001','authenticated','authenticated','emblems-admin@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_public,is_admin) values('15000000-0000-0000-0000-000000000001','emblems_admin',true,true);
insert into public.clubs(id,external_id,name,short_name,area_name) overriding system value
  values(980001,980065,'Emblems Home FC','Emblems Home','England'),(980002,980066,'Emblems Away FC','Emblems Away','England');

set local role anon;
select ok(not has_table_privilege('anon','public.club_emblem_batches','select'),'anonymous cannot inspect staging');
select ok(not has_table_privilege('anon','public.club_provider_ids','select'),'provider mappings are server only');
select ok(not has_function_privilege('anon','public.admin_apply_club_emblems(uuid,uuid)','execute'),'anonymous cannot apply emblems');
set local role authenticated;
select ok(not has_function_privilege('authenticated','public.admin_stage_club_emblems(jsonb,text,integer,uuid)','execute'),'signed-in users cannot stage emblems');
set local role postgres;

create temporary table emblem_test_state(value jsonb);
grant all on emblem_test_state to service_role;
set local role service_role;
insert into emblem_test_state select public.admin_stage_club_emblems(
  '[{"club_id":980001,"legacy_external_id":980065,"club_name":"Emblems Home FC","provider_id":980050,"provider_name":"Emblems Home","country":"England","source_url":"https://media.api-sports.io/football/teams/980050.png"}]','PL',2024,'15000000-0000-0000-0000-000000000001');
select is((select logo_asset_id from public.clubs where id=980001),null::bigint,'staging does not change the public club');
select is((select public.admin_apply_club_emblems((value->>'batch')::uuid,'15000000-0000-0000-0000-000000000001')->>'applied' from emblem_test_state),'1','batch applies atomically');
select is((select public.admin_apply_club_emblems((value->>'batch')::uuid,'15000000-0000-0000-0000-000000000001')->>'applied' from emblem_test_state),'1','repeat apply is idempotent');
select is((select external_id from public.clubs where id=980001),980065::bigint,'legacy football-data ID is unchanged');
select is((select external_id from public.club_provider_ids where provider='api-football' and club_id=980001),980050::bigint,'API-Football ID has its own mapping');
select is((select usage_status from public.media_assets where source_url='https://media.api-sports.io/football/teams/980050.png'),'identification','logo does not claim verified rights');

set local role anon;
select is((select count(*)::integer from public.media_assets where source_url='https://media.api-sports.io/football/teams/980050.png'),1,'identification asset is readable');
select is(public.get_club_page(980001)->'club'->'media'->>'usage_status','identification','club page resolves identification through the shared predicate');
select is(public.get_club_marks(array[980001,980001,980002])->0->'media'->>'url','https://media.api-sports.io/football/teams/980050.png','marks are available through a bounded public aggregate');
set local role service_role;
insert into public.media_assets(asset_type,source_provider,source_url,usage_status)
  values('club_logo','api-football','https://media.api-sports.io/football/teams/980099.png','unknown');
set local role anon;
select is((select count(*)::integer from public.media_assets where source_url='https://media.api-sports.io/football/teams/980099.png'),0,'unknown candidates remain invisible');
set local role service_role;
select throws_ok($sql$insert into public.media_assets(asset_type,source_provider,source_url,usage_status) values('player_photo','api-football','https://media.api-sports.io/football/teams/980088.png','identification')$sql$,'23514',null,'identification cannot include photos or omit its usage policy');
select is((select public.admin_rollback_club_emblems((value->>'batch')::uuid,'15000000-0000-0000-0000-000000000001')->>'restored' from emblem_test_state),'1','rollback restores the previous connection');
select is((select logo_asset_id from public.clubs where id=980001),null::bigint,'previous empty logo is restored');
select is((select count(*)::integer from public.club_provider_ids where club_id=980001),0,'rollback removes only a newly created provider mapping');
set local role postgres;
select * from finish();
rollback;
