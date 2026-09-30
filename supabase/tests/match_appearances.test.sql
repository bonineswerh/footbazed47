begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(24);

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('16000000-0000-0000-0000-000000000001','authenticated','authenticated','appearance-owner@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_admin) values('16000000-0000-0000-0000-000000000001','appearance_owner',true);
insert into public.clubs(id,name) overriding system value values(980001,'Historical Home'),(980002,'Historical Away'),(980003,'New Club');
insert into public.matches(id,league_name,league_code,season,home_team_name,away_team_name,match_date,status,home_club_id,away_club_id)
overriding system value values(980001,'Premier League','PL','2024','Historical Home','Historical Away','2024-03-05T20:00:00Z','finished',980001,980002),
(980002,'Premier League','PL','2024','Historical Away','Historical Home','2024-03-12T20:00:00Z','finished',980002,980001);
insert into public.players(id,name,team,club_id) overriding system value values(980001,'Transferred Starter','Historical Home',980001),
(980002,'Unused Bench','Historical Home',980001),(980003,'Legacy Player','Historical Home',980001);
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',980001,980001),('api-football',980002,980002),('api-football',980003,980003);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id) values(980001,980001,980001,980002);
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
values(980001,980001,980001,980001,'Transferred Starter','starter'),(980001,980002,980002,980001,'Unused Bench','bench'),
(980001,980003,980003,980001,'Legacy Player','starter'),(980001,980004,null,980002,'Unmapped Starter','starter');
insert into public.ratings(user_id,match_id,match_rating,supporter_side) values('16000000-0000-0000-0000-000000000001',980001,8,'neutral');
insert into public.player_ratings(user_id,match_id,player_id,rating,is_best_player)
values('16000000-0000-0000-0000-000000000001',980001,980003,7,true);
delete from public.match_player_appearances where match_id=980001 and player_id=980003;
update public.players set club_id=980003,team='New Club' where id=980001;

select is(has_table_privilege('authenticated','public.match_player_appearances','INSERT'),false,'clients cannot forge appearances');
select is(has_table_privilege('anon','public.player_provider_ids','SELECT'),false,'provider identity mappings are private');
select is(has_function_privilege('authenticated','public.admin_apply_match_lineup(uuid,uuid)','EXECUTE'),false,'lineup apply is service-only');
select is(has_function_privilege('authenticated','public.is_confirmed_or_unchanged_player_rating(uuid,bigint,bigint,smallint,boolean)','EXECUTE'),false,'legacy helper does not expose private scores');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_match_lineup(980001)->>'available')::boolean,true,'historical lineup is publicly readable');
select is((public.get_match_lineup(980002)->>'available')::boolean,false,'missing lineup is explicitly unavailable');
select is(public.get_match_lineup(999999999),null::jsonb,'missing match does not invent a lineup');
select is((select (p->>'eligible')::boolean from jsonb_array_elements(public.get_match_lineup(980001)->'players') p where p->>'provider_player_id'='980004'),false,'unmapped players remain visible but cannot be rated');
select is((select (p->>'eligible')::boolean from jsonb_array_elements(public.get_match_lineup(980001)->'players') p where p->>'player_id'='980002'),false,'unused substitutes are ineligible');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_match_rating(980001,9::smallint,'Edited review',true,'[{"player_id":980001,"rating":9},{"player_id":980003,"rating":7,"is_best_player":true}]','neutral')$$,'transfer does not remove eligibility and unchanged legacy score survives');
select is((select count(*)::integer from public.player_ratings where match_id=980001),2,'review edits preserve earlier player scores');
select throws_ok($$select public.save_match_rating(980001,6::smallint,'Invalid bench',true,'[{"player_id":980002,"rating":8}]','neutral')$$,'22023','player_not_in_match','club membership without participation is insufficient');
select is((select match_rating::integer from public.ratings where match_id=980001),9,'invalid player draft rolls back match score too');
select throws_ok($$select public.save_match_rating(980001,9::smallint,null,true,'[{"player_id":980003,"rating":8}]','neutral')$$,'22023','player_not_in_match','unconfirmed legacy score cannot be changed');
select lives_ok($$select public.save_match_rating(980001,9::smallint,null,true,'[{"player_id":980001,"rating":9}]','neutral')$$,'owner can explicitly remove a legacy player score');
select throws_ok($$select public.save_match_rating(980001,9::smallint,null,true,'[{"player_id":980003,"rating":7}]','neutral')$$,'22023','player_not_in_match','removed unconfirmed score cannot be recreated');
reset role;
select throws_ok($$update public.matches set home_club_id=980003 where id=980001$$,'22023','historical_fixture_identity_locked','sync cannot move imported appearances to a different fixture');
select throws_ok($$insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation) values(980001,99999,980001,980001,'Wrong ID','starter')$$,'22023','appearance_player_mapping_mismatch','internal player must match the provider identity');
select throws_ok($$insert into public.match_player_appearances(match_id,provider_player_id,club_id,name,participation) values(980001,99999,980003,'Wrong Club','starter')$$,'22023','appearance_club_mismatch','historical team must be one of the fixture participants');
select throws_ok($$insert into public.match_player_appearances(match_id,provider_player_id,club_id,name,participation) values(980001,99999,980001,'Unconfirmed Sub','substitute')$$,'23514',null,'substitutes require an entry event or positive minutes');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('footbazed.test_batch',public.admin_stage_match_lineup(980002,
  jsonb_build_object('provider','api-football','fixture_id',980002,'match_date','2024-03-12T20:00:00Z','league_code','PL','season',2024,
    'home_club_id',980002,'away_club_id',980001,'events_available',false,'statistics_available',false,
    'players',(select jsonb_agg(jsonb_build_object('provider_player_id',990000+n,'club_id',case when n<=11 then 980002 else 980001 end,
      'name','Imported starter '||n,'participation','starter')) from generate_series(1,22) n)),
  '16000000-0000-0000-0000-000000000001')->>'batch',true);
select lives_ok($$select public.admin_apply_match_lineup(current_setting('footbazed.test_batch')::uuid,'16000000-0000-0000-0000-000000000001')$$,'reviewed batch imports a complete historical lineup atomically');
select is((select count(*)::integer from public.match_player_appearances where match_id=980002),22,'both starting elevens are saved');
select lives_ok($$select public.admin_apply_match_lineup(current_setting('footbazed.test_batch')::uuid,'16000000-0000-0000-0000-000000000001')$$,'repeated apply is idempotent');
select is((select count(*)::integer from public.admin_audit_logs where action='apply_match_lineup' and target_id='980002'),1,'one import produces one audit entry');
reset role;
select * from finish();
rollback;
