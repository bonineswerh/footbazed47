begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('69000000-0000-0000-0000-00000000000'||i)::uuid,'authenticated','authenticated','calendar'||i||'@example.test','{}','{}',now(),now() from generate_series(1,3) i;
insert into public.users(id,username,display_name)
select ('69000000-0000-0000-0000-00000000000'||i)::uuid,'Calendar_'||i,'Calendar '||i from generate_series(1,3) i;
insert into public.clubs(id,name) overriding system value values (997601,'Calendar White'),(997602,'Calendar Blue'),(997603,'Calendar Red');
insert into public.club_aliases(club_id,alias) values(997601,'Календарный белый');
insert into public.favorite_clubs(user_id,club_id) values
('69000000-0000-0000-0000-000000000001',997601),('69000000-0000-0000-0000-000000000002',997603);
insert into public.matches(id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value
select 997700+i,'Calendar Cup','Calendar White','Calendar Blue',997601,997602,'2099-10-07T00:00:00Z'::timestamptz+i*interval '30 minutes','finished' from generate_series(0,25) i;
insert into public.matches(id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value values
(997726,'Calendar Cup','Calendar Red','Calendar Blue',997603,997602,'2099-10-07T15:00:00Z','scheduled'),
(997727,'Calendar Cup','Calendar Blue','Calendar White',997602,997601,'2099-10-08T00:00:00Z','scheduled'),
(997728,'Calendar Cup','Calendar White','Calendar Blue',997601,997602,'2099-10-06T23:59:59Z','finished');
select ok(not (select prosecdef from pg_proc where oid='public.get_match_calendar_page(jsonb,integer,integer)'::regprocedure),'reader has invoker rights');
select ok(not has_table_privilege('anon','public.favorite_clubs','SELECT'),'raw favorite clubs remain unavailable to guests');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid='public.get_match_calendar_page(jsonb,integer,integer)'::regprocedure and a.grantee=0),'no implicit PUBLIC execute');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_match_calendar_page('{"league":"Calendar Cup","from":"2099-10-07T00:00:00Z","until":"2099-10-08T00:00:00Z"}')->>'total')::integer,27,'day bounds include midnight and exclude following midnight');
select is(jsonb_array_length(public.get_match_calendar_page('{"league":"Calendar Cup"}',12,0)->'items'),12,'first page is bounded');
select is((public.get_match_calendar_page('{"league":"Calendar Cup"}',12,12)->>'next_offset')::integer,24,'next offset uses server pagination');
select throws_ok($$select public.get_match_calendar_page('{"favorites_only":true}')$$,'42501','authentication_required','guest cannot read favorite selection');
select lives_ok($$select public.get_match_calendar_page('{"favorites_only":false}')$$,'guest public reader never requires favorite table grants');
select is((public.get_match_calendar_page('{"league":"Calendar Cup","query":"календарный белый"}')->>'total')::integer,28,'Russian alias works with calendar filters');
select is((public.get_match_calendar_page('{"league":"Calendar Cup","status":"scheduled"}')->>'total')::integer,2,'status filter combines with league');
select throws_ok($$select public.get_match_calendar_page('{"from":"2099-10-07T00:00:00Z"}')$$,'22023','invalid_calendar_range','both date bounds are required');
select throws_ok($$select public.get_match_calendar_page('{"from":"2099-10-08T00:00:00Z","until":"2099-10-07T00:00:00Z"}')$$,'22023','invalid_calendar_range','reverse interval denied');
select throws_ok($$select public.get_match_calendar_page('{"from":"2099-10-07T00:00:00Z","until":"2099-10-09T00:00:00Z"}')$$,'22023','invalid_calendar_range','unbounded multi-day scan denied');
select throws_ok($$select public.get_match_calendar_page('{"from":"2099-10-07","until":"2099-10-08"}')$$,'22023','invalid_calendar_range','timezone-free date interval denied');
select throws_ok($$select public.get_match_calendar_page('{"from":"2099-02-30T00:00:00Z","until":"2099-03-01T00:00:00Z"}')$$,'22023','invalid_calendar_range','invalid date denied');
select throws_ok($$select public.get_match_calendar_page('{"status":"private"}')$$,'22023','invalid_match_status','unsupported status denied');
select throws_ok($$select public.get_match_calendar_page('{"user_id":"69000000-0000-0000-0000-000000000002"}')$$,'22023','invalid_calendar_filters','client cannot inject a favorite owner');
select throws_ok($$select public.get_match_calendar_page('{"favorites_only":"true"}')$$,'22023','invalid_calendar_filters','favorite flag requires boolean');
select throws_ok($$select public.get_match_calendar_page('[]')$$,'22023','invalid_calendar_filters','non-object filters denied');
select lives_ok($$select public.get_match_calendar_page('{"from":"2026-03-08T05:00:00Z","until":"2026-03-09T04:00:00Z"}')$$,'23 hour local day accepted');
select lives_ok($$select public.get_match_calendar_page('{"from":"2026-11-01T04:00:00Z","until":"2026-11-02T05:00:00Z"}')$$,'25 hour local day accepted');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"69000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}')->>'total')::integer,28,'owner favorite filter spans both home and away sides');
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}')->>'favorite_club_count')::integer,1,'reader counts only own favorite clubs');
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup","from":"2099-10-07T00:00:00Z","until":"2099-10-08T00:00:00Z"}',12,24)->>'total')::integer,26,'favorite and date filters run before pagination count');
select is(jsonb_array_length(public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup","from":"2099-10-07T00:00:00Z","until":"2099-10-08T00:00:00Z"}',12,24)->'items'),2,'final favorite page retains only matching fixtures');
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}',12,24)->>'has_more')::boolean,false,'last page has no phantom continuation');
select ok(not (public.get_match_calendar_page('{"favorites_only":true}') ? 'user_id'),'response contains no owner identity');
select set_config('request.jwt.claims','{"sub":"69000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}')->>'total')::integer,1,'second account has its own selection');
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}')->'items'->0->>'id')::integer,997726,'second account cannot receive first owner selection');
select set_config('request.jwt.claims','{"sub":"69000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((public.get_match_calendar_page('{"favorites_only":true,"league":"Calendar Cup"}')->>'total')::integer,0,'empty favorites show no matches');
select is((public.get_match_calendar_page('{"favorites_only":true}')->>'favorite_club_count')::integer,0,'empty selection is explicit');
reset role;
select * from finish();
rollback;
