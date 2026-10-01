begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(22);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('14000000-0000-0000-0000-000000000001','authenticated','authenticated','explore-owner@example.test','{}','{}',now(),now()),
('14000000-0000-0000-0000-000000000002','authenticated','authenticated','explore-private@example.test','{}','{}',now(),now());
insert into public.users(id,username,is_public) values
('14000000-0000-0000-0000-000000000001','explore_owner',true),
('14000000-0000-0000-0000-000000000002','explore_private',false);
insert into public.media_assets(id,asset_type,source_provider,source_url,usage_status,license_name) overriding system value values
(970001,'club_logo','fixture','https://example.test/club.png','verified','Test fixture only'),
(970002,'club_logo','fixture','https://example.test/unknown.png','unknown',null);
insert into public.clubs(id,name,logo_asset_id) overriding system value values
(970001,'Renamed Home',970001),(970002,'Original Away',970002),(970003,'Other Home',null);
insert into public.competitions(id,name) overriding system value values(970001,'ID Tournament A'),(970002,'ID Tournament B');
insert into public.matches(id,home_team_name,away_team_name,league_name,match_date,status,home_score,away_score,home_club_id,away_club_id,competition_id)
overriding system value select 970000+n,case when n<=10 then 'Original Home' else 'Other Home' end,'Original Away','Shared Legacy Alias',
case when n<=10 then '2026-09-01'::timestamptz+(n-1)*interval '1 day' else '2026-10-01'::timestamptz end,
'finished',0,1,case when n<=10 then 970001 else 970003 end,970002,case when n<=10 then 970001 else 970002 end from generate_series(1,12) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,created_at,supporter_side,comment)
select '14000000-0000-0000-0000-000000000001',970000+n,case when n<=10 then 8 else 10 end,n<>1,
'2026-11-01'::timestamptz+(13-n)*interval '1 day','neutral',case when n=5 then 'Fixture review' else '' end from generate_series(1,12) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,supporter_side) values
('14000000-0000-0000-0000-000000000002',970002,1,true,'neutral');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2"}')->>'total')::integer,11,'v2 diary excludes owner-private ratings for anonymous callers');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2"}')->'items'->0->>'match_id')::bigint,970012::bigint,'v2 uses match date and rating ID tie-breaker');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001')->'items'->0->>'match_id')::bigint,970002::bigint,'old clients retain creation-date ordering');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2"}',null,2)->'months'->0->>'matches')::integer,2,'month summary includes the entire filtered month');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","competition_id":"970001"}',null,2)->'months'->0->>'matches')::integer,9,'month summary is not truncated to the page and respects privacy');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","competition_id":"970001"}')->'months'->0->>'reviews')::integer,1,'month review count uses visible records');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","club_id":"970001","home_score":"0"}')->>'total')::integer,9,'ID filter survives renaming and accepts zero goals');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","competition_id":"970002","club_id":"970001"}')->>'total')::integer,0,'incompatible IDs do not broaden the diary');
select is(get_profile_diary('14000000-0000-0000-0000-000000000002','{"v":"2"}'),null::jsonb,'private diary and its filter options remain unavailable');
select is((get_football_statistics('matches','{"competition_id":"970001","club_id":"970001"}')->>'total')::integer,9,'statistics use stable IDs and exclude private profiles');
select is((get_football_statistics('leagues')->>'total')::integer,2,'different competition IDs never merge because of a shared display alias');
select is((get_football_statistics('clubs','{"club_id":"970001"}')->'summary'->>'votes')::integer,9,'club filtering never double-counts match votes');
select is((get_football_statistics('matches','{"competition_id":"970002"}')->'items'->0->>'home_club_id')::bigint,970003::bigint,'match rows carry exact club IDs for batched marks');
select is((get_football_statistics('clubs','{"query":"Renamed Home"}')->'items'->0->'media'->>'usage_status'),'verified','statistics expose only the permitted media payload');
select is(get_football_statistics('clubs','{"query":"Original Away"}')->'items'->0->'media','null'::jsonb,'unknown media is never exposed through enrichment');
select ok((get_football_statistics()->'clubs' @> '[{"id":970002,"competition_ids":[970001,970002]}]'::jsonb),'dependent club options come from actual fixtures across tournaments');
select throws_ok($$select get_football_statistics('matches','{"club_id":"-1"}')$$,'22023','invalid_statistics_filters','invalid club IDs are rejected');
select throws_ok($$select get_profile_diary('14000000-0000-0000-0000-000000000001','{"competition_id":"1;select"}')$$,'22023','invalid_diary_filters','malformed competition IDs are rejected');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","competition_id":"970001"}')->'months'->0->>'matches')::integer,10,'own month summary includes own private rating');
select is((get_football_statistics('matches','{"competition_id":"970001"}')->>'total')::integer,9,'own private rating still cannot enter community statistics');
with first_page as(select get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2"}',null,2) data),
second_page as(select get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2"}',data->'next_cursor',2) data from first_page)
select is((select count(*)::integer from jsonb_array_elements((select data->'items' from first_page)) a join jsonb_array_elements((select data->'items' from second_page)) b on a->>'id'=b->>'id'),0,'match-date cursor does not repeat equal-date matches');
select is((get_profile_diary('14000000-0000-0000-0000-000000000001','{"v":"2","club_id":"999999"}')->>'total')::integer,0,'a missing ID stays an empty selection rather than silently showing all');
reset role;
select * from finish();
rollback;
