begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(30);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('59100000-0000-0000-0000-00000000000'||i)::uuid,'authenticated','authenticated','dismiss'||i||'@example.test','{}','{}',now(),now() from generate_series(1,2) i;
insert into public.users(id,username,is_public) values
('59100000-0000-0000-0000-000000000001','Dismiss_Owner',true),
('59100000-0000-0000-0000-000000000002','Dismiss_Other',true);
insert into public.notifications(id,user_id,type,message,read,created_at) overriding system value values
(959201,'59100000-0000-0000-0000-000000000001','system','Owner unread',false,now()),
(959202,'59100000-0000-0000-0000-000000000001','system','Owner read',true,now()),
(959203,'59100000-0000-0000-0000-000000000002','system','Other unread',false,now());
select ok(not has_function_privilege('anon','public.set_notification_dismissed(integer,boolean)','execute'),'guests cannot dismiss notifications');
select ok(not has_table_privilege('anon','public.notification_dismissals','select'),'guests cannot read dismissed IDs');
select ok(not has_table_privilege('authenticated','public.notifications','delete'),'raw notification deletion stays denied');
select ok(not has_table_privilege('authenticated','public.notification_dismissals','update'),'dismissal ownership cannot be rewritten');
select ok(not has_function_privilege('anon','private.is_notification_dismissed(integer)','execute'),'guests cannot probe dismissal metadata');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"59100000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_notifications_page_v2()->>'unread_count')::integer,1,'initial badge count');
select throws_ok($$select public.set_notification_dismissed(null,true)$$,'22023','invalid_notification_update','ID is required');
select throws_ok($$select public.set_notification_dismissed(0,true)$$,'22023','invalid_notification_update','ID must be positive');
select throws_ok($$select public.set_notification_dismissed(959201,null)$$,'22023','invalid_notification_update','state cannot be null');
select throws_ok($$select public.set_notification_dismissed(959203,true)$$,'42501','notification_unavailable','another account cannot be dismissed');
select is((public.set_notification_dismissed(959201,true)->>'affected')::integer,1,'owner dismisses unread event');
select is((select count(*)::integer from public.notifications where id=959201),0,'raw owner inbox also excludes dismissal');
select is((public.get_notifications_page_v2()->>'unread_count')::integer,0,'badge count excludes dismissed unread event');
select is(jsonb_array_length(public.get_notifications_page_v2()->'items'),1,'history excludes dismissed event before limit');
select is((public.set_notification_dismissed(959201,true)->>'affected')::integer,0,'repeated dismissal is idempotent');
select is((public.set_notification_dismissed(959201,false)->>'unread_count')::integer,1,'undo restores original unread state');
select is((select read from public.notifications where id=959201),false,'dismissal never marks an event read');
select is((public.set_notification_dismissed(959202,true)->>'unread_count')::integer,1,'read event can also be dismissed');
select is((public.set_notification_dismissed(959202,false)->>'unread_count')::integer,1,'restoring a read event does not increase badge');
select is((select read from public.notifications where id=959202),true,'read state survives round trip');
select lives_ok($$select public.set_notification_dismissed(959201,true)$$,'dismissal can be persisted again');
select set_config('request.jwt.claims','{"sub":"59100000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.notification_dismissals),0,'other accounts cannot read dismissed IDs');
select throws_ok($$select private.is_notification_dismissed(959201)$$,'42501','permission denied for schema private','private predicate is not directly accessible to clients');
select throws_ok($$select public.set_notification_dismissed(959201,false)$$,'42501','notification_unavailable','other accounts cannot restore an event');
select throws_ok($$insert into public.notification_dismissals(notification_id,user_id) values(959203,'59100000-0000-0000-0000-000000000001')$$,'42501',null::text,'raw insert cannot forge the owner');
select is((public.get_notifications_page_v2()->>'unread_count')::integer,1,'other account unread events stay intact');
reset role;
select is((select count(*)::integer from public.notifications where id between 959201 and 959203),3,'all underlying events are retained');
select is((select count(*)::integer from public.notification_dismissals),1,'only the own dismissal is persisted');
insert into public.notifications(id,user_id,from_user_id,type,message,read) overriding system value values
(959204,'59100000-0000-0000-0000-000000000001','59100000-0000-0000-0000-000000000002','system','Blocked source',false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"59100000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select public.set_user_block('59100000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.set_notification_dismissed(959204,true)$$,'42501','notification_unavailable','blocked source stays unavailable to the invoker mutation');
select throws_ok($$insert into public.notification_dismissals(notification_id,user_id) values(959204,'59100000-0000-0000-0000-000000000001')$$,'42501',null::text,'raw dismissal insert also preserves block privacy');
reset role;
select * from finish();
rollback;
