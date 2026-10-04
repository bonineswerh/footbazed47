begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(37);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('56000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'historical'||i||'@example.test',crypt('historical-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now() from generate_series(1,2) i;
insert into public.users(id,username,is_public) select ('56000000-0000-0000-0000-00000000000'||i)::uuid,'historical_'||i,true from generate_series(1,2) i;
insert into public.competitions(id,name,code) overriding system value values(956001,'Historical League','HST');
insert into public.clubs(id,name,short_name) overriding system value values(956001,'Historical Club A','Club A'),(956002,'Current Club B','Club B');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value
select 956000+i,956001,'Historical League','Historical Club A','Current Club B',956001,956002,'2026-09-20T12:00Z'::timestamptz-i*interval '1 day','finished' from generate_series(1,3) i;
insert into public.players(id,name,team,club_id) overriding system value values(956001,'Historical Player','Historical Club A',956001);
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',1956001,956001);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id) select id,id+1000000,956001,956002 from public.matches where id between 956001 and 956003;
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
select id,1956001,956001,956001,'Historical Player',case when id=956003 then 'bench' else 'starter' end from public.matches where id between 956001 and 956003;
insert into public.ratings(user_id,match_id,match_rating,is_public,comment) values
('56000000-0000-0000-0000-000000000001',956001,8,true,null),('56000000-0000-0000-0000-000000000002',956001,8,true,null),
('56000000-0000-0000-0000-000000000001',956002,5,false,'historical-private-review-marker'),('56000000-0000-0000-0000-000000000001',956003,5,true,null);
-- An existing pre-enforcement vote for a bench player is preserved as legacy.
alter table public.player_ratings disable trigger validate_player_rating_roster_trigger;
insert into public.player_ratings(user_id,match_id,player_id,rating,is_best_player) values
('56000000-0000-0000-0000-000000000001',956001,956001,9,true),('56000000-0000-0000-0000-000000000002',956001,956001,7,false),
('56000000-0000-0000-0000-000000000001',956002,956001,10,true),('56000000-0000-0000-0000-000000000001',956003,956001,2,false);
alter table public.player_ratings enable trigger validate_player_rating_roster_trigger;

select is(has_table_privilege('anon','private.community_player_performances','SELECT'),false,'no guest access to internal vote identities');
select is(has_table_privilege('authenticated','private.community_player_performances','SELECT'),false,'no signed-in raw performance access');
select is(has_table_privilege('service_role','private.community_player_performances','SELECT'),false,'no new raw service endpoint');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in
('public.get_club_page(bigint)'::regprocedure,'public.get_player_page(bigint)'::regprocedure,'public.get_match_insights(bigint)'::regprocedure,'public.get_football_statistics(text,jsonb,integer,integer)'::regprocedure)),'aggregate-only readers retain the fixed trusted path');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_social_feed_page(text,integer,timestamptz,integer,integer)'::regprocedure),'feed preserves its guarded definer reader and fixed path');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_club_page(956001)#>>'{stats,player_rating}')::numeric,8.0::numeric,'club mean is confirmed fixture performances only');
select is((public.get_club_page(956001)#>>'{stats,player_rating_count}')::integer,2,'private and legacy votes do not enter club count');
select is((public.get_club_page(956002)#>>'{stats,player_rating_count}')::integer,0,'opponent does not acquire player votes');
select is((public.get_player_page(956001)#>>'{stats,average}')::numeric,8.0::numeric,'player confirmed mean remains separate');
select is((public.get_player_page(956001)#>>'{stats,unverified_rating_count}')::integer,1,'bench legacy vote is explicitly unconfirmed');
select is((public.get_player_page(956001)#>>'{stats,unverified_average}')::numeric,2.0::numeric,'legacy mean is separate and excludes private votes');
select is(jsonb_array_length(public.get_player_page(956001)->'performances'),2,'both public confirmed and legacy history are retained');
select is((public.get_football_statistics('players','{"competition_id":"956001"}')#>>'{items,0,average}')::numeric,6.0::numeric,'old overview callers retain full-history compatibility');
select is((public.get_football_statistics('players','{"competition_id":"956001","confirmed_only":true}')#>>'{items,0,average}')::numeric,8.0::numeric,'confirmed filter excludes bench and private votes');
select is((public.get_football_statistics('players','{"competition_id":"956001","confirmed_only":true}')#>>'{summary,excluded_unverified_performance_votes}')::integer,1,'excluded legacy scope is explained');
select is((public.get_football_statistics('players','{"club_id":"956001"}')#>>'{items,0,average}')::numeric,8.0::numeric,'club filter refers to historical player side');
select is((public.get_football_statistics('players','{"club_id":"956002"}')->>'total')::integer,0,'club filter excludes opponents and unknown historical clubs');
select is((public.get_football_statistics('matches','{"club_id":"956002"}')->>'total')::integer,2,'match club filter keeps its original either-side meaning');
select throws_ok($$select public.get_football_statistics('players','{"confirmed_only":"true"}')$$,'22023','invalid_statistics_filters','confirmation filter must be a JSON boolean');
select is((public.get_match_insights(956001)#>>'{top_players,0,team}'),'Historical Club A','match choice uses fixture team');
select is(jsonb_array_length(public.get_match_insights(956003)->'top_players'),0,'unconfirmed bench vote cannot become a match top player');
reset role;

update public.players set club_id=956002,team='Current Club B' where id=956001;
set local role anon;
select is((public.get_club_page(956001)#>>'{stats,player_rating}')::numeric,8.0::numeric,'transfer preserves old club mean');
select is((public.get_club_page(956002)#>>'{stats,player_rating_count}')::integer,0,'transfer cannot move historical votes to new club');
select ok(public.get_club_page(956002)#>'{squad,0,average}'='null'::jsonb,'current squad only counts performances for that club');
select is((public.get_club_page(956001)#>>'{rated_performers,0,id}')::bigint,956001::bigint,'former player remains in historical club performers');
select is(jsonb_array_length(public.get_club_page(956001)->'squad'),0,'historical list is independent of current squad');
select is(public.get_player_page(956001)#>>'{player,club,name}','Current Club B','current club remains honestly identified');
select is((select (x->>'historical_club_id')::bigint from jsonb_array_elements(public.get_player_page(956001)->'performances') x where x->>'match_id'='956001'),956001::bigint,'performance retains its historical club after transfer');
select ok((select x->'historical_club_id'='null'::jsonb from jsonb_array_elements(public.get_player_page(956001)->'performances') x where x->>'match_id'='956003'),'bench legacy has no guessed club');
select is(public.get_match_insights(956001)#>>'{top_players,0,team}','Historical Club A','match labels never follow the current roster');
select is((public.get_football_statistics('players','{"club_id":"956001","confirmed_only":true}')#>>'{items,0,subtitle}'),'Club A','overview labels historical club');
select ok(concat(public.get_club_page(956001),public.get_player_page(956001),public.get_match_insights(956001),public.get_football_statistics('players','{"competition_id":"956001"}')) not like '%historical-private-review-marker%' and concat(public.get_club_page(956001),public.get_player_page(956001)) not like '%56000000-0000%','aggregate outputs contain no review or voter identity');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"56000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_player_page(956001)#>>'{stats,average}')::numeric,8.0::numeric,'private-vote owner sees the same public confirmed mean');
select is((select rating::integer from public.player_ratings where user_id=auth.uid() and match_id=956002),10,'owner keeps their private vote');
select is((select x#>>'{player_highlights,0,team}' from jsonb_array_elements(public.get_social_feed_page()->'items') x where x->>'match_id'='956001' limit 1),'Historical Club A','feed highlights retain historical team');
select ok((select x#>'{player_highlights,0,club_id}'='null'::jsonb from jsonb_array_elements(public.get_social_feed_page()->'items') x where x->>'match_id'='956003' limit 1),'feed legacy context never infers current club');
reset role;
select is((select count(*)::integer from public.player_ratings where player_id=956001),4,'no public private or legacy vote is rewritten');
select * from finish();
rollback;
