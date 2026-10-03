begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(35);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('59000000-0000-0000-0000-00000000000'||i)::uuid,'authenticated','authenticated','notif'||i||'@example.test','{}','{}',now(),now() from generate_series(1,3) i;
insert into public.users(id,username,display_name,is_public)
select ('59000000-0000-0000-0000-00000000000'||i)::uuid,'Notif_'||i,'Notification '||i,i<>3 from generate_series(1,3) i;
insert into public.matches(id,league_name,home_team_name,away_team_name,match_date,status)
overriding system value values(959001,'Notification League','Home','Away',now()-interval '1 day','finished');
insert into public.ratings(id,user_id,match_id,match_rating,is_public,created_at) overriding system value values
(959701,'59000000-0000-0000-0000-000000000001',959001,9,true,now()-interval '2 years'),
(959702,'59000000-0000-0000-0000-000000000002',959001,8,false,now());
insert into public.rating_comments(rating_id,user_id,comment)
select id,'59000000-0000-0000-0000-000000000002','Target comment' from public.ratings where match_id=959001 and match_rating=9;
select set_config('test.comment_notification_id',(select id::text from public.notifications where user_id='59000000-0000-0000-0000-000000000001' and type='comment'),true);
-- Separate synthetic system events model a history with identical timestamps.
insert into public.notifications(id,user_id,from_user_id,type,message,read,created_at) overriding system value
select 959100+i,'59000000-0000-0000-0000-000000000001',null,'system','Event '||i,false,'2026-10-03T10:00:00Z' from generate_series(1,26) i;
insert into public.notifications(id,user_id,from_user_id,type,message,read,created_at) overriding system value values
(959130,'59000000-0000-0000-0000-000000000002',null,'system','Other account',false,now());
select ok(not has_function_privilege('anon','public.get_notifications_page(boolean,timestamptz,integer,integer)','EXECUTE'),'guests cannot read notification pages');
select ok(not has_function_privilege('anon','public.set_notification_read(integer,boolean,integer)','EXECUTE'),'guests cannot mark notifications');
select ok(not has_function_privilege('authenticated','private.notify_friend_acceptance()','EXECUTE'),'clients cannot forge acceptance events');
select ok(has_column_privilege('authenticated','public.notifications','read','UPDATE'),'read state is writable');
select ok(not has_column_privilege('authenticated','public.notifications','message','UPDATE'),'identity and message stay protected');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"59000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_notifications_page()->>'unread_count')::integer,27,'unread count covers history and generated comment');
select is(jsonb_array_length(public.get_notifications_page()->'items'),20,'default history is bounded');
select is((public.get_notifications_page()->>'has_more')::boolean,true,'older history is reachable');
select is((public.get_notifications_page(false,'2026-10-03T10:00:00Z',959107,20)->'items'->0->>'id')::integer,959106,'tie cursor advances by ID without repeats');
select is(jsonb_array_length(public.get_notifications_page(false,'2026-10-03T10:00:00Z',959107,20)->'items'),6,'oldest tie page is complete');
select throws_ok($$select public.get_notifications_page(false,now(),null,20)$$,'22023','invalid_notification_cursor','half cursors fail');
select is((public.set_notification_read(959126,true,null)->>'affected')::integer,1,'single read is persisted');
select is((public.set_notification_read(959126,true,null)->>'affected')::integer,0,'repeat read is idempotent');
select is((public.set_notification_read(959126,false,null)->>'unread_count')::integer,27,'single unread restores count');
select throws_ok($$select public.set_notification_read(959130,true,null)$$,'42501','notification_unavailable','another account cannot be marked');
select throws_ok($$select public.set_notification_read(null,true,null)$$,'22023','invalid_notification_update','empty marking fails');
select throws_ok($$select public.set_notification_read(null,false,959126)$$,'22023','invalid_notification_update','bulk unread is forbidden');
select throws_ok($$update public.notifications set rating_id=null where id=959126$$,'42501',null,'direct writes cannot rewrite target');
select throws_ok($$update public.notifications set read=null where id=959126$$,'23514',null,'read state cannot disappear through direct writes');
select is((public.get_rating_entry((select id from public.ratings where match_id=959001 and match_rating=9))->>'match_rating')::integer,9,'old exact entry opens without recent feed scan');
select ok(public.get_rating_entry(959702) is null,'foreign private rating remains unavailable');
select is(public.get_rating_comment((select id from public.ratings where match_id=959001 and match_rating=9),(select id from public.rating_comments where comment='Target comment'))->>'comment','Target comment','exact scoped comment opens');
select ok(public.get_rating_comment(959999,(select id from public.rating_comments where comment='Target comment')) is null,'comment cannot cross its parent');
reset role;
insert into public.notifications(id,user_id,type,message,read) overriding system value values(959150,'59000000-0000-0000-0000-000000000001','system','New arrival',false);
set local role authenticated;
select is((public.set_notification_read(null,true,959126)->>'unread_count')::integer,1,'bounded read preserves arrival after snapshot');
select is(jsonb_array_length(public.get_notifications_page(true)->'items'),1,'unread filter excludes marked history');
reset role;
insert into public.notifications(id,user_id,from_user_id,type,message) overriding system value values(959151,'59000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000003','friend_request','Private name snapshot');
set local role authenticated;
select ok(public.get_notifications_page()->'items'->0->'actor'='null'::jsonb,'closed actor identity is not enriched');
select ok(public.get_notifications_page()->'items'->0->'message'='null'::jsonb,'old text cannot disclose hidden actor name');
reset role;
insert into public.friendships(user_id,friend_id,status) values('59000000-0000-0000-0000-000000000002','59000000-0000-0000-0000-000000000001','pending');
set local role authenticated;
select lives_ok($$select public.respond_friendship('59000000-0000-0000-0000-000000000002','accept')$$,'recipient accepts request');
reset role;
select is((select count(*)::integer from public.notifications where user_id='59000000-0000-0000-0000-000000000002' and type='friend_accepted'),1,'acceptance produces one notification to requester');
update public.friendships set status='accepted' where user_id='59000000-0000-0000-0000-000000000002' and friend_id='59000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.notifications where user_id='59000000-0000-0000-0000-000000000002' and type='friend_accepted'),1,'repeated accepted state cannot produce duplicate');
set local role authenticated;
select public.set_user_block('59000000-0000-0000-0000-000000000002',true);
select ok(not jsonb_path_exists(public.get_notifications_page(false,null,null,50),'$.items[*] ? (@.type == "comment")'),'blocked source disappears from history RPC');
select throws_ok($$select public.set_notification_read(current_setting('test.comment_notification_id')::integer,true,null)$$,'42501','notification_unavailable','blocked source cannot be marked through RPC');
select is((public.get_notifications_page()->>'unread_count')::integer,(select count(*)::integer from public.notifications where user_id=auth.uid() and not read),'history and head count have the same block scope');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select public.get_notifications_page()$$,'42501','auth_required','authenticated role without identity cannot read');
select throws_ok($$select public.set_notification_read(959126,true,null)$$,'42501','auth_required','authenticated role without identity cannot write');
select * from finish();
rollback;
