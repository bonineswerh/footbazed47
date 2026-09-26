begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

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
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(not has_function_privilege('anon', 'public.edit_direct_message(bigint,text)', 'EXECUTE'), 'anon cannot invoke private message edits');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.edit_direct_message(981001, 'Allowed edit')->>'body', 'Allowed edit', 'author edits while friendship is active');
select throws_ok($$select public.edit_direct_message(981001, repeat('x', 2001))$$, '22023', 'invalid_message', 'oversized edit is rejected');
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.edit_direct_message(981001, 'Spoofed edit')$$, 'P0002', 'message_not_found', 'recipient cannot edit the author message');
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.edit_direct_message(981001, 'Unrelated edit')$$, 'P0002', 'message_not_found', 'unrelated user cannot edit a message');
select throws_ok($$select public.get_direct_messages(980001, 50, null)$$, '42501', 'conversation_forbidden', 'unrelated user cannot read private messages');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.remove_friendship('12000000-0000-0000-0000-000000000002')->>'status', 'removed', 'author can remove friendship');
select throws_ok($$select public.edit_direct_message(981001, 'Edit after removal')$$, '42501', 'friendship_required', 'former friend cannot edit previously sent messages');
select throws_ok($$select public.send_direct_message(980001, 'Send after removal')$$, '42501', 'friendship_required', 'former friend cannot send new messages');
select throws_ok($$select public.get_direct_messages(980001, 50, null)$$, '42501', 'conversation_forbidden', 'former friend cannot read message history');
select is((select count(*)::integer from public.direct_messages where id = 981001), 0, 'RLS also hides messages after friendship removal');
reset role;
select is((select body from public.direct_messages where id = 981001), 'Allowed edit', 'rejected mutations leave message contents intact');
select * from finish();
rollback;
