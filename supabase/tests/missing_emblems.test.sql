begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(9);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values('18000000-0000-0000-0000-000000000001','authenticated','authenticated','missing-emblems-admin@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_public,is_admin) values('18000000-0000-0000-0000-000000000001','missing_emblems_admin',true,true);
insert into public.clubs(id,external_id,name,area_name) overriding system value values(981001,981065,'Direct Club FC','England');
create temporary table direct_emblem_state(value jsonb);
grant all on direct_emblem_state to service_role;
set local role service_role;
insert into direct_emblem_state select public.admin_stage_club_emblems(
  '[{"club_id":981001,"legacy_external_id":981065,"club_name":"Direct Club FC","provider_id":981050,"provider_name":"Direct Club","country":"England","source_url":"https://media.api-sports.io/football/teams/981050.png"}]',
  'CATALOG',null,'18000000-0000-0000-0000-000000000001');
select is((select season from public.club_emblem_batches where id=(select (value->>'batch')::uuid from direct_emblem_state)),null::integer,'direct lookup retains a genuinely absent season');
select is((select public.admin_apply_club_emblems((value->>'batch')::uuid,'18000000-0000-0000-0000-000000000001')->>'applied' from direct_emblem_state),'1','catalog batch uses the same atomic apply');
select is((select metadata->>'lookup_mode' from public.media_assets where source_url='https://media.api-sports.io/football/teams/981050.png'),'team-search','source lookup mode is explicit');
select is((select metadata->>'season' from public.media_assets where source_url='https://media.api-sports.io/football/teams/981050.png'),null::text,'direct logo never claims coverage of a season');
select is((select license_name from public.media_assets where source_url='https://media.api-sports.io/football/teams/981050.png'),null::text,'direct logo does not invent a license');
select is((select external_id from public.clubs where id=981001),981065::bigint,'direct import preserves legacy provider identity');
select throws_ok($$select public.admin_stage_club_emblems('[{"club_id":981001,"legacy_external_id":981065,"club_name":"Direct Club FC","provider_id":981050,"provider_name":"Direct Club","country":"England","source_url":"https://media.api-sports.io/football/teams/981050.png"}]','CATALOG',2024,'18000000-0000-0000-0000-000000000001')$$,'22023','invalid_emblem_batch','catalog context cannot claim a season');
select is((select public.admin_rollback_club_emblems((value->>'batch')::uuid,'18000000-0000-0000-0000-000000000001')->>'restored' from direct_emblem_state),'1','direct lookup remains reversible');
set local role authenticated;
select ok(not has_function_privilege('authenticated','public.admin_stage_club_emblems(jsonb,text,integer,uuid)','execute'),'client still cannot stage catalog assets');
reset role;
select * from finish();
rollback;
