begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('12000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'dm-owner@example.test', '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'dm-friend@example.test', '{}', '{}', now(), now()),
  ('12000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'dm-other@example.test', '{}', '{}', now(), now());
insert into public.users (id, username, display_name) values
  ('12000000-0000-0000-0000-000000000001', 'dm_owner', 'DM Owner'),
  ('12000000-0000-0000-0000-000000000002', 'dm_friend', 'DM Friend'),
  ('12000000-0000-0000-0000-000000000003', 'dm_other', 'DM Other');
insert into public.friendships (user_id, friend_id, status) values
  ('12000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'accepted'),
  ('12000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'accepted');
insert into public.direct_conversations (id, user_a, user_b) values
  (980001, '12000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002');
insert into public.direct_messages (id, conversation_id, sender_id, body) values
  (981001, 980001, '12000000-0000-0000-0000-000000000001', 'Original message');


set local role anon;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","role":"anon"}',true);
select throws_ok($$select public.get_match_chat_messages(1,80)$$,'42501','permission denied for function get_match_chat_messages','anon cannot use get_match_chat_messages');
select throws_ok($$select public.send_match_chat_message(1,'test')$$,'42501','permission denied for function send_match_chat_message','anon cannot use send_match_chat_message');
select throws_ok($$select public.edit_match_chat_message(1,'test')$$,'42501','permission denied for function edit_match_chat_message','anon cannot use edit_match_chat_message');
select throws_ok($$select public.get_or_create_direct_conversation('12000000-0000-0000-0000-000000000002')$$,'42501','permission denied for function get_or_create_direct_conversation','anon cannot use get_or_create_direct_conversation');
select throws_ok($$select public.get_direct_messages(980001,20,null)$$,'42501','permission denied for function get_direct_messages','anon cannot use get_direct_messages');
select throws_ok($$select public.send_direct_message(980001,'test')$$,'42501','permission denied for function send_direct_message','anon cannot use send_direct_message');
select throws_ok($$select public.edit_direct_message(981001,'test')$$,'42501','permission denied for function edit_direct_message','anon cannot use edit_direct_message');
select throws_ok($$select * from public.chat_messages$$,'42501','permission denied for table chat_messages','anon cannot read archived chat_messages');
select throws_ok($$select * from public.direct_conversations$$,'42501','permission denied for table direct_conversations','anon cannot read archived direct_conversations');
select throws_ok($$select * from public.direct_messages$$,'42501','permission denied for table direct_messages','anon cannot read archived direct_messages');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.get_match_chat_messages(1,80)$$,'42501','permission denied for function get_match_chat_messages','authenticated cannot use get_match_chat_messages');
select throws_ok($$select public.send_match_chat_message(1,'test')$$,'42501','permission denied for function send_match_chat_message','authenticated cannot use send_match_chat_message');
select throws_ok($$select public.edit_match_chat_message(1,'test')$$,'42501','permission denied for function edit_match_chat_message','authenticated cannot use edit_match_chat_message');
select throws_ok($$select public.get_or_create_direct_conversation('12000000-0000-0000-0000-000000000002')$$,'42501','permission denied for function get_or_create_direct_conversation','authenticated cannot use get_or_create_direct_conversation');
select throws_ok($$select public.get_direct_messages(980001,20,null)$$,'42501','permission denied for function get_direct_messages','authenticated cannot use get_direct_messages');
select throws_ok($$select public.send_direct_message(980001,'test')$$,'42501','permission denied for function send_direct_message','authenticated cannot use send_direct_message');
select throws_ok($$select public.edit_direct_message(981001,'test')$$,'42501','permission denied for function edit_direct_message','authenticated cannot use edit_direct_message');
select throws_ok($$select * from public.chat_messages$$,'42501','permission denied for table chat_messages','authenticated cannot read archived chat_messages');
select throws_ok($$select * from public.direct_conversations$$,'42501','permission denied for table direct_conversations','authenticated cannot read archived direct_conversations');
select throws_ok($$select * from public.direct_messages$$,'42501','permission denied for table direct_messages','authenticated cannot read archived direct_messages');
reset role;
select is((select body from public.direct_messages where id=981001),'Original message','retirement preserves message data');
select is((select count(*)::integer from public.direct_conversations where id=980001),1,'retirement preserves the conversation');
select ok(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='direct_messages'),'no realtime message publication');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Retired chat media is inaccessible' and permissive='RESTRICTIVE'),'storage independently denies retired media');
select is((select count(*)::integer from pg_policies where schemaname='public' and policyname='Retired messaging is inaccessible' and permissive='RESTRICTIVE'),3,'all archive tables have restrictive deny policies');
select * from finish();
rollback;
