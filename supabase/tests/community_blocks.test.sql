begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(78);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('56000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'block'||i||'@example.test',crypt('block-fixture',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,5) i;
insert into public.users(id,username,display_name,is_public,invite_code)
select ('56000000-0000-0000-0000-00000000000'||i)::uuid,'block_'||i,'Block '||i::text,i<>4,'BLOCK'||i from generate_series(1,5) i;
insert into public.clubs(id,name) overriding system value values(956001,'Block Home'),(956002,'Block Away');
insert into public.competitions(id,name,code) overriding system value values(956001,'Block League','BLK');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value
select 956000+i,956001,'Block League','Block Home','Block Away',956001,956002,now()-i*interval '1 day','finished' from generate_series(1,3) i;
insert into public.players(id,name,team,club_id) overriding system value values(956001,'Block Player','Block Home',956001);
-- Player votes require confirmed participation even in isolated service-seeded fixtures.
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',956001,956001);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id) values(956001,956001,956001,956002);
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
  values(956001,956001,956001,956001,'Block Player','starter');
insert into public.ratings(id,user_id,match_id,match_rating,is_public,comment) overriding system value values
(956001,'56000000-0000-0000-0000-000000000001',956001,9,true,'Own public'),
(956002,'56000000-0000-0000-0000-000000000002',956001,7,true,'Target public'),
(956003,'56000000-0000-0000-0000-000000000003',956001,5,true,'Third person public'),
(956004,'56000000-0000-0000-0000-000000000001',956002,1,false,'Own private');
insert into public.player_ratings(user_id,match_id,player_id,rating)
values('56000000-0000-0000-0000-000000000001',956001,956001,9),('56000000-0000-0000-0000-000000000002',956001,956001,7);
insert into public.friendships(user_id,friend_id,status) values
('56000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000002','accepted'),
('56000000-0000-0000-0000-000000000002','56000000-0000-0000-0000-000000000001','accepted'),
('56000000-0000-0000-0000-000000000003','56000000-0000-0000-0000-000000000001','pending'),
('56000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000004','accepted');
insert into public.rating_likes(user_id,rating_id) values('56000000-0000-0000-0000-000000000001',956002),('56000000-0000-0000-0000-000000000002',956001);
insert into public.rating_comments(id,user_id,rating_id,comment,created_at) overriding system value values
(956001,'56000000-0000-0000-0000-000000000002',956003,'Target comment',now()-interval '3 days'),
(956002,'56000000-0000-0000-0000-000000000001',956002,'Own on target',now()-interval '2 days'),
(956003,'56000000-0000-0000-0000-000000000003',956003,'Third comment',now()-interval '1 day');
insert into public.notifications(user_id,from_user_id,type,message) values
('56000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000002','like','Target notification'),
('56000000-0000-0000-0000-000000000001',null,'like','System notification');
create temp table block_before as select
  public.get_club_page(956001)->'stats' club_stats,
  public.get_player_page(956001)->'stats' player_stats,
  public.get_match_insights(956001) match_stats,
  public.get_football_statistics('matches',jsonb_build_object('competition_id',956001)) overview,
  (select count(*) from public.ratings where id between 956001 and 956004) ratings,
  (select count(*) from public.player_ratings where player_id=956001) player_ratings,
  (select count(*) from public.friendships where user_id::text like '56000000%') friendships,
  (select count(*) from public.rating_comments where id between 956001 and 956003) comments;
grant select on block_before to authenticated,anon;
select ok(not has_table_privilege('authenticated','private.community_user_blocks','SELECT'),'raw block pairs are closed');
select ok(not has_table_privilege('authenticated','private.community_user_blocks','INSERT'),'block owner cannot directly insert pairs');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'private helpers cannot be resolved by clients');
select ok(not has_function_privilege('anon','public.set_user_block(uuid,boolean)','EXECUTE'),'anonymous block mutation is denied');
select ok(not has_function_privilege('anon','public.get_my_user_blocks(integer,integer)','EXECUTE'),'anonymous block list is denied');
select ok(not has_function_privilege('service_role','public.set_user_block(uuid,boolean)','EXECUTE'),'service cannot impersonate a personal block owner');
select ok((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='public.set_user_block(uuid,boolean)'::regprocedure),'block mutation is a fixed-path protected function');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.set_user_block('56000000-0000-0000-0000-000000000002',true)$$,'42501','auth_required','no identity cannot block');
select throws_ok($$select public.get_my_user_blocks()$$,'42501','auth_required','no identity cannot list blocks');
select set_config('request.jwt.claims','{"sub":"56000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select private.community_pair_is_clear(auth.uid(),'56000000-0000-0000-0000-000000000002')$$,'42501',null,'direct private helper execution is denied by schema privilege');
select throws_ok($$select public.set_user_block(auth.uid(),true)$$,'22023','invalid_block','cannot block oneself');
select throws_ok($$select public.set_user_block('56000000-0000-0000-0000-000000000002',null)$$,'22023','invalid_block','null state is rejected');
select throws_ok($$select public.set_user_block('56000000-0000-0000-0000-000000000099',true)$$,'42501','user_unavailable','missing profile does not disclose its state');
select is(public.set_user_block('56000000-0000-0000-0000-000000000002',true)->>'changed','true','owner can block an accepted friend');
select is(public.set_user_block('56000000-0000-0000-0000-000000000002',true)->>'changed','false','repeated block is idempotent');
select is((public.get_my_user_blocks()->>'total')::integer,1,'owner list contains own outgoing block');
select is(public.get_my_user_blocks()->'items'->0->>'username','block_2','own list keeps a previously visible label for unblocking');
select ok(not (public.get_my_user_blocks()->'items'->0) ?| array['email','is_admin','invite_code','user_id_owner','blocked_by'],'list exposes no private fields or incoming blocker');
select is((select count(id)::integer from public.users where id='56000000-0000-0000-0000-000000000002'),0,'raw users SELECT hides blocked public profile despite permissive public policy');
select is((select count(*)::integer from public.ratings where user_id='56000000-0000-0000-0000-000000000002'),0,'raw rating SELECT hides target');
select is((select count(*)::integer from public.player_ratings where user_id='56000000-0000-0000-0000-000000000002'),0,'raw player votes hide target');
select is((select count(*)::integer from public.ratings where user_id=auth.uid()),2,'own private and public history remains readable');
select is(public.get_profile_page('56000000-0000-0000-0000-000000000002'),null::jsonb,'definer profile reader cannot bypass block');
select is(public.get_profile_diary('56000000-0000-0000-0000-000000000002'),null::jsonb,'invoker diary denies blocked profile');
select is(public.get_profile_comparison_page('56000000-0000-0000-0000-000000000002'),null::jsonb,'new comparison cannot reveal blocked identity or votes');
select throws_ok($$select public.get_profile_comparison('56000000-0000-0000-0000-000000000002')$$,'42501','friendship_required','legacy comparison cannot bypass blocked friendship');
select ok(not public.is_user_visible('56000000-0000-0000-0000-000000000002'),'accepted friend helper observes personal restriction');
select is((select count(*)::integer from public.resolve_invite_code('BLOCK2')),0,'invite-code reader cannot bypass block');
select ok(not exists(select 1 from jsonb_array_elements(public.get_social_feed_page()->'items') item where item->>'user_id'='56000000-0000-0000-0000-000000000002'),'cursor feed hides blocked author');
select ok(not exists(select 1 from jsonb_array_elements(public.get_social_feed()->'items') item where item->>'user_id'='56000000-0000-0000-0000-000000000002'),'legacy feed hides blocked author');
select ok(not exists(select 1 from jsonb_array_elements(public.get_leaderboard()) item where item->>'id'='56000000-0000-0000-0000-000000000002'),'legacy leaderboard hides blocked profile');
select is(jsonb_array_length(public.get_rating_comments(956003)),1,'comments hide blocked author on a third-person review');
select is(jsonb_array_length(public.get_rating_comments(956002)),0,'comments cannot reveal blocked review through definer reader');
select is((select count(*)::integer from public.rating_comments where id=956002),0,'own comment on blocked review stays in storage but is hidden from public read');
select is((select count(*)::integer from public.rating_likes where user_id='56000000-0000-0000-0000-000000000002'),0,'raw reactions cannot reveal blocked author');
select is((select count(*)::integer from public.friendships where friend_id='56000000-0000-0000-0000-000000000002' or user_id='56000000-0000-0000-0000-000000000002'),0,'friend rows are filtered without deletion');
select is((select count(*)::integer from public.notifications where from_user_id='56000000-0000-0000-0000-000000000002'),0,'old contact notifications become hidden');
select is((select count(*)::integer from public.notifications where from_user_id is null),1,'system notifications remain visible');
select throws_ok($$select public.request_friendship('56000000-0000-0000-0000-000000000002')$$,'42501','user_unavailable','accepted-state fast path cannot bypass block');
select throws_ok($$select public.respond_friendship('56000000-0000-0000-0000-000000000002','accept')$$,'42501','user_unavailable','repeat acceptance fast path cannot bypass block');
select throws_ok($$select public.add_rating_comment(956002,'New unwanted comment')$$,'42501','user_unavailable','comment trigger denies new contact');
select throws_ok($$select public.edit_rating_comment(956002,'Unwanted edit')$$,'42501','user_unavailable','comment edit cannot notify blocked target');
select is(public.toggle_rating_like(956002)->>'liked','false','existing own reaction can still be removed');
select throws_ok($$select public.toggle_rating_like(956002)$$,'42501','user_unavailable','new reaction cannot contact target');
select throws_ok($$select public.submit_community_report('rating','956002','spam')$$,'42501','report_target_unavailable','report endpoint cannot probe blocked review');
select throws_ok($$select public.submit_community_report('comment','956001','spam')$$,'42501','report_target_unavailable','report endpoint cannot probe blocked comment author');
select is(public.get_club_page(956001)->'stats',(select club_stats from block_before),'personal block does not alter club football aggregates');
select is(public.get_player_page(956001)->'stats',(select player_stats from block_before),'personal block does not alter player football aggregates');
select is(public.get_match_insights(956001),(select match_stats from block_before),'personal block does not alter match football aggregates');
select is(public.get_football_statistics('matches',jsonb_build_object('competition_id',956001)),(select overview from block_before),'personal block does not alter overview aggregates');
select is(public.set_user_block('56000000-0000-0000-0000-000000000003',true)->>'changed','true','pending incoming request can be blocked');
select throws_ok($$select public.respond_friendship('56000000-0000-0000-0000-000000000003','accept')$$,'42501','user_unavailable','pending acceptance cannot bypass block');
select is(jsonb_array_length(public.get_my_user_blocks(0,1)->'items'),1,'block list is bounded');
select is(public.get_my_user_blocks(0,1)->>'has_more','true','block pagination identifies a next page');
select throws_ok($$select public.get_my_user_blocks(10001)$$,'22023','invalid_block_page','excessive offsets are rejected');
select set_config('request.jwt.claims','{"sub":"56000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((public.get_my_user_blocks()->>'total')::integer,0,'target cannot enumerate who blocked it');
select is(public.get_profile_page('56000000-0000-0000-0000-000000000001'),null::jsonb,'profile visibility is mutual');
select is((select count(*)::integer from public.ratings where user_id='56000000-0000-0000-0000-000000000001'),0,'raw votes are mutually filtered');
select throws_ok($$select public.request_friendship('56000000-0000-0000-0000-000000000001')$$,'42501','user_unavailable','target cannot restart contact');
select is(public.set_user_block('56000000-0000-0000-0000-000000000001',false)->>'changed','false','target cannot remove another owner block');
select throws_ok($$select public.set_user_block('56000000-0000-0000-0000-000000000001',true)$$,'42501','user_unavailable','incoming block cannot be used to expose a hidden identity');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(id)::integer from public.users where id='56000000-0000-0000-0000-000000000002'),1,'public profile stays public to guests; personal block is not global privacy');
select is((select count(*)::integer from public.ratings where id=956002),1,'guest public review scope is preserved');
reset role;
select set_config('request.jwt.claims','{}',true);
select is((select count(*) from public.ratings where id between 956001 and 956004),(select ratings from block_before),'block preserves every match rating');
select is((select count(*) from public.player_ratings where player_id=956001),(select player_ratings from block_before),'block preserves every player rating');
select is((select count(*) from public.friendships where user_id::text like '56000000%'),(select friendships from block_before),'block preserves all friendship history');
select is((select count(*) from public.rating_comments where id between 956001 and 956003),(select comments from block_before),'block preserves all comments');
-- Trusted restoration can preserve historical interaction rows without notifying a logged-in target.
select lives_ok($$update public.rating_comments set comment='Historical import' where id=956002$$,'service-style historical restore remains compatible');
update public.users set is_public=false where id='56000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"56000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(public.set_user_block('56000000-0000-0000-0000-000000000002',false)->>'changed','true','owner can unblock after target privacy changes');
select is(public.set_user_block('56000000-0000-0000-0000-000000000002',false)->>'changed','false','repeated unblock is idempotent');
select ok(public.get_profile_page('56000000-0000-0000-0000-000000000002') is not null,'unblock restores previously accepted private friendship');
select is((select count(*)::integer from public.ratings where id=956002),1,'unblock restores public review visibility');
select is(jsonb_array_length(public.get_rating_comments(956002)),1,'unblock restores historical comment');
select is(public.set_user_block('56000000-0000-0000-0000-000000000004',true)->>'changed','true','visible accepted private friend can be blocked');
select lives_ok($$select public.remove_friendship('56000000-0000-0000-0000-000000000004')$$,'removing a hidden friendship remains possible');
select is(public.set_user_block('56000000-0000-0000-0000-000000000004',false)->>'changed','true','unblock does not require fresh access to a now-private profile');
select throws_ok($$select public.set_user_block('56000000-0000-0000-0000-000000000004',true)$$,'42501','user_unavailable','closed stranger cannot be exposed by block creation');
select lives_ok($$select public.delete_rating_comment(956002)$$,'owner can remove historical comments');
reset role;
select * from finish();
rollback;
