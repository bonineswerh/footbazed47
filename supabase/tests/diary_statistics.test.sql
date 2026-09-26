begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(17);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('13000000-0000-0000-0000-000000000001','authenticated','authenticated','diary-owner@example.test','{}','{}',now(),now()),
('13000000-0000-0000-0000-000000000002','authenticated','authenticated','diary-private@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_public) values
('13000000-0000-0000-0000-000000000001','diary_owner',true),
('13000000-0000-0000-0000-000000000002','diary_private',false);
insert into public.clubs(id,name) overriding system value values(960001,'Diary Home'),(960002,'Diary Away');
insert into public.matches(id,home_team_name,away_team_name,league_name,match_date,status,home_score,away_score,home_club_id,away_club_id)
select 960000+n,'Diary Home','Diary Away',case when n<=9 then 'Diary League A' else 'Diary League B' end,
 '2026-09-01'::timestamptz+(n-1)*interval '1 day','finished',2,1,960001,960002 from generate_series(1,18) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,created_at,supporter_side)
select '13000000-0000-0000-0000-000000000001',960000+n,case when n<=9 then 9 else 7 end,n>2,
'2026-09-26'::timestamptz,'neutral' from generate_series(1,18) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,supporter_side)
values('13000000-0000-0000-0000-000000000002',960001,1,true,'neutral');
insert into public.players(id,name,team,club_id) overriding system value values(960001,'Diary Player','Diary Home',960001);
insert into public.player_ratings(user_id,match_id,player_id,rating,is_best_player)
values('13000000-0000-0000-0000-000000000001',960003,960001,9,false);

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001')->>'total')::integer,16,'anon only sees public diary entries');
select is(jsonb_array_length(public.get_profile_diary('13000000-0000-0000-0000-000000000001')->'items'),8,'first diary page is bounded');
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001')->>'has_more')::boolean,true,'next page is advertised');
select is(public.get_profile_diary('13000000-0000-0000-0000-000000000002'),null::jsonb,'private profile is hidden from anon');
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001','{"league":"Diary League A"}')->>'total')::integer,7,'league filter searches the full visible diary');
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001','{"query":"Away","min_rating":9,"from":"2026-09-05","to":"2026-09-09","home_score":2,"away_score":1}')->>'total')::integer,5,'combined date rating score and search filters');
select is((public.get_football_statistics('matches','{"league":"Diary League A"}')->>'total')::integer,7,'statistics exclude private ratings and private profiles');
select is((public.get_football_statistics('clubs','{"league":"Diary League A"}')->'items'->0->>'average')::numeric,9.0::numeric,'club average uses public match votes');
select is((public.get_football_statistics('players','{"league":"Diary League A"}')->'items'->0->>'average')::numeric,9.0::numeric,'player average uses player votes');
select is((public.get_football_statistics('leagues','{"league":"Diary League A"}')->'items'->0->>'votes')::integer,7,'league counts its eligible ratings');
select is((public.get_football_statistics('matches','{"league":"Diary League A","min_votes":2}')->>'total')::integer,0,'minimum sample filter hides one-vote matches');
select throws_ok($$select public.get_football_statistics('users')$$,'22023','invalid_statistics_filters','no user leaderboard or unsupported kinds');
select throws_ok($$select public.get_profile_diary('13000000-0000-0000-0000-000000000001','{"from":"2026-09-20","to":"2026-09-01"}')$$,'22023','invalid_diary_filters','reversed dates are rejected');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001')->>'total')::integer,18,'author sees all own diary entries');
select is((public.get_football_statistics('matches','{"league":"Diary League A"}')->>'total')::integer,7,'own private ratings never enter public aggregates');
with first_page as(select public.get_profile_diary('13000000-0000-0000-0000-000000000001') data), second_page as(
select public.get_profile_diary('13000000-0000-0000-0000-000000000001','{}',data->'next_cursor') data from first_page)
select is((select count(*)::integer from jsonb_array_elements((select data->'items' from first_page)) a
join jsonb_array_elements((select data->'items' from second_page)) b on a->>'id'=b->>'id'),0,'cursor handles identical timestamps without duplicate entries');
select is((public.get_profile_diary('13000000-0000-0000-0000-000000000001','{"query":"does not exist"}')->>'total')::integer,0,'empty search has an exact zero count');
reset role;
select * from finish();
rollback;
