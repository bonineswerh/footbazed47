begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(42);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('55000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'aggregate'||i||'@example.test',crypt('aggregate-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,3) i;
insert into public.users(id,username,display_name,is_public)
select ('55000000-0000-0000-0000-00000000000'||i)::uuid,'aggregate_'||i,'Aggregate '||i::text,i<>3 from generate_series(1,3) i;
insert into public.competitions(id,name,code) overriding system value values(955001,'Aggregate League','AGG');
insert into public.clubs(id,name,short_name) overriding system value values(955001,'Aggregate Home','Home'),(955002,'Aggregate Away','Away');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value
select 955000+i,955001,'Aggregate League','Aggregate Home','Aggregate Away',955001,955002,now()-i*interval '1 day','finished' from generate_series(1,3) i;
insert into public.players(id,name,team,club_id) overriding system value values(955001,'Aggregate Player','Aggregate Home',955001),(955002,'Private Only Player','Aggregate Home',955001);
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',955001,955001),('api-football',955002,955002);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id)
select id,id,955001,955002 from public.matches where id between 955001 and 955003;
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
select m.id,p.id,p.id,955001,p.name,'starter' from public.matches m cross join public.players p
where m.id between 955001 and 955003 and p.id between 955001 and 955002;
insert into public.ratings(user_id,match_id,match_rating,is_public,comment)
values('55000000-0000-0000-0000-000000000001',955001,9,true,null),
('55000000-0000-0000-0000-000000000002',955001,7,true,null),
('55000000-0000-0000-0000-000000000003',955001,5,true,null),
('55000000-0000-0000-0000-000000000001',955002,1,false,'aggregate-private-review-marker'),
('55000000-0000-0000-0000-000000000002',955003,2,false,null);
insert into public.player_ratings(user_id,match_id,player_id,rating,is_best_player)
values('55000000-0000-0000-0000-000000000001',955001,955001,9,true),
('55000000-0000-0000-0000-000000000002',955001,955001,7,false),
('55000000-0000-0000-0000-000000000003',955001,955001,5,false),
('55000000-0000-0000-0000-000000000001',955002,955001,1,true),
('55000000-0000-0000-0000-000000000001',955002,955002,4,false),
-- A different owner's private match also cannot enter the public player sample.
('55000000-0000-0000-0000-000000000002',955003,955001,2,false);
insert into public.favorite_clubs(user_id,club_id) values('55000000-0000-0000-0000-000000000001',955001);
select throws_ok($$insert into public.player_ratings(user_id,match_id,player_id,rating)
values('55000000-0000-0000-0000-000000000003',955003,955002,2)$$,'23503',null,'the existing parent-rating FK still prevents orphan votes');

select is(has_table_privilege('anon','private.community_public_match_votes','SELECT'),false,'anon cannot read aggregate source rows');
select is(has_table_privilege('authenticated','private.community_public_match_votes','SELECT'),false,'signed-in clients cannot read aggregate source rows');
select is(has_table_privilege('authenticated','private.community_public_player_votes','SELECT'),false,'player source rows remain internal');
select is(has_table_privilege('service_role','private.community_public_player_votes','SELECT'),false,'internal scope is not a new raw service endpoint');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
where oid in('public.get_club_page(bigint)'::regprocedure,'public.get_player_page(bigint)'::regprocedure,
'public.get_match_insights(bigint)'::regprocedure,'public.get_football_statistics(text,jsonb,integer,integer)'::regprocedure)),
'aggregate-only readers have a fixed trusted path');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is(public.get_club_page(955001)->>'is_favorite','false','guest cannot inherit an owner favorite');
select is((public.get_club_page(955001)#>>'{stats,player_rating}')::numeric,7.0::numeric,'club average counts only public parent votes');
select is((public.get_club_page(955001)#>>'{stats,player_rating_count}')::integer,3,'club excludes both owners private votes');
select is((public.get_club_page(955001)#>>'{squad,0,average}')::numeric,7.0::numeric,'squad rows use the same public scope');
select is((public.get_player_page(955001)#>>'{stats,average}')::numeric,7.0::numeric,'player average uses public parent votes');
select is((public.get_player_page(955001)#>>'{stats,rating_count}')::integer,3,'player count excludes both owners private votes');
select is((public.get_player_page(955001)#>>'{stats,matches_rated}')::integer,1,'only one public rated performance');
select is(jsonb_array_length(public.get_player_page(955001)->'performances'),1,'private performances never appear');
select ok(public.get_player_page(955002)#>'{stats,average}'='null'::jsonb,'no public player sample produces null, not a private score');
select is((public.get_match_insights(955001)->>'average')::numeric,7.0::numeric,'match contract retains all public votes');
select is((public.get_match_insights(955001)->>'rating_count')::integer,3,'match count includes public votes independent of profile visibility');
select is((public.get_match_insights(955002)#>>'{distribution,9,count}')::integer,0,'private match score never enters distribution');
select is((public.get_match_insights(955001)#>>'{top_players,0,best_votes}')::integer,1,'private best-player choice never enters top players');
select is((public.get_football_statistics('leagues','{"competition_id":"955001"}')#>>'{items,0,average}')::numeric,8.0::numeric,'overview retains its public-profile scope');
select ok(concat(public.get_club_page(955001),public.get_player_page(955001),public.get_match_insights(955001),
public.get_football_statistics('leagues','{"competition_id":"955001"}')) not like '%aggregate-private-review-marker%'
and concat(public.get_club_page(955001),public.get_player_page(955001),public.get_match_insights(955001),
public.get_football_statistics('leagues','{"competition_id":"955001"}')) not like '%55000000-0000-0000-0000-0000000000%',
'aggregates expose neither private review text nor voter identity');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_club_page(955001)#>>'{stats,player_rating}')::numeric,7.0::numeric,'private-vote owner sees the same club average');
select is((public.get_player_page(955001)#>>'{stats,average}')::numeric,7.0::numeric,'private-vote owner sees the same player average');
select is((public.get_player_page(955001)#>>'{stats,rating_count}')::integer,3,'owner-private votes cannot change the count');
select is((select count(*)::integer from public.ratings where user_id=auth.uid()),2,'owner still reads all their historical match votes');
select is((select count(*)::integer from public.player_ratings where user_id=auth.uid() and match_id=955002),2,'private individual player scores remain in owner history');
select is(public.get_club_page(955001)->>'is_favorite','true','favorite flag remains explicitly scoped to current actor');
select is((public.get_match_insights(955001)->>'average')::numeric,7.0::numeric,'match average is identical for owner and guest');
select ok(public.get_player_page(955002)#>'{stats,average}'='null'::jsonb,'private-only player does not show an owner-specific public average');
reset role;

-- Model stricter personal visibility without creating real blocks. Global
-- numbers must not change when a reader's raw rows/profiles become unavailable.
create policy aggregate_test_hide_other_votes on public.ratings as restrictive for select to authenticated using(user_id=(select auth.uid()));
create policy aggregate_test_hide_other_players on public.player_ratings as restrictive for select to authenticated using(user_id=(select auth.uid()));
create policy aggregate_test_hide_other_profiles on public.users as restrictive for select to authenticated using(id=(select auth.uid()));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.ratings where match_id=955001 and is_public),1,'fixture policy really hides other raw votes');
select is((select count(*)::integer from public.player_ratings where match_id=955001),1,'fixture policy really hides other raw player votes');
select is((select count(*)::integer from public.users where id='55000000-0000-0000-0000-000000000002'),0,'fixture policy really hides the other voter profile');
select is((public.get_match_insights(955001)->>'rating_count')::integer,3,'personal row visibility cannot change match count');
select is((public.get_player_page(955001)#>>'{stats,rating_count}')::integer,3,'personal row visibility cannot change player count');
select is((public.get_club_page(955001)#>>'{stats,player_rating_count}')::integer,3,'personal row visibility cannot change club count');
select is((public.get_football_statistics('leagues','{"competition_id":"955001"}')#>>'{items,0,average}')::numeric,8.0::numeric,'personal profile visibility cannot change league averages');
select is(public.get_club_page(955001)->>'is_favorite','true','global aggregate does not remove legitimate favorite context');
select set_config('request.jwt.claims','{"sub":"55000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(public.get_club_page(955001)->>'is_favorite','false','another account cannot inherit the previous owner favorite');
select is((public.get_player_page(955001)#>>'{stats,rating_count}')::integer,3,'second viewer has identical public count');
select is((select count(*)::integer from public.ratings where user_id=auth.uid()),2,'second viewer retains their own public and private raw history');
reset role;
select is((select count(*)::integer from public.ratings where match_id between 955001 and 955003),5,'all match rows are preserved');
select is((select count(*)::integer from public.player_ratings where match_id between 955001 and 955003),6,'private player rows remain preserved');
select * from finish();
rollback;
