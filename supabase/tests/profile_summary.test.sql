begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(24);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('52000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'summary'||i||'@example.test',crypt('summary-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,3) i;
insert into public.users(id,username,is_public)
select ('52000000-0000-0000-0000-00000000000'||i)::uuid,'summary_'||i,i<>2 from generate_series(1,3) i;
insert into public.competitions(id,name,short_name,code) overriding system value
select 961000+i,'Summary tournament '||i,'Same tournament label','SUM'||i from generate_series(1,8) i;
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,match_date,status) overriding system value
select 963000+i,961001+((i-1)%8),'Same tournament label','Summary Home','Summary Away',now()-i*interval '1 day','finished'
from generate_series(1,65) i;
insert into public.ratings(user_id,match_id,match_rating,is_public,comment)
select '52000000-0000-0000-0000-000000000001',963000+i,case when i<=60 then 9 else 3 end,i<=60,
  case when i<=2 then '  A review  ' when i=61 then 'Private review' else '   ' end from generate_series(1,65) i;
insert into public.ratings(user_id,match_id,match_rating,is_public) values
('52000000-0000-0000-0000-000000000002',963001,10,true),('52000000-0000-0000-0000-000000000002',963002,1,false);
select ok(has_function_privilege('anon','public.get_profile_page(uuid,integer)','EXECUTE'),'anonymous read grant preserved');
select ok(has_function_privilege('authenticated','public.get_profile_page(uuid,integer)','EXECUTE'),'authenticated read grant preserved');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"52000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(jsonb_array_length(public.get_profile_page('52000000-0000-0000-0000-000000000001',1)->'ratings'),1,'rating page remains bounded');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001',1)#>>'{rating_summary,total}')::integer,65,'full summary is independent of the rating page');
select is(public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,scope}','own','owner scope is explicit');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,average}')::numeric,8.5::numeric,'owner average includes private history');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,reviewed}')::integer,3,'whitespace is not counted as a review');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,minimum}')::integer,3,'full minimum includes old private scores for the owner');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,tournament_count}')::integer,8,'tournaments are grouped by internal identity despite equal labels');
select is(jsonb_array_length(public.get_profile_page('52000000-0000-0000-0000-000000000001')#>'{rating_summary,tournaments}'),6,'top tournament response is bounded');
select is(jsonb_array_length(public.get_profile_page('52000000-0000-0000-0000-000000000001')#>'{rating_summary,distribution}'),10,'all ten rating bins are present');
select is((select sum((x->>'count')::integer)::integer from jsonb_array_elements(public.get_profile_page('52000000-0000-0000-0000-000000000001')#>'{rating_summary,distribution}') x),65,'distribution accounts for the entire history');
select ok(public.get_profile_page('52000000-0000-0000-0000-000000000002') is null,'private stranger remains hidden');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000003')#>>'{rating_summary,total}')::integer,0,'empty visible history has a zero count');
select ok(public.get_profile_page('52000000-0000-0000-0000-000000000003')#>'{rating_summary,average}'='null'::jsonb,'empty average is null instead of an invented rating');
reset role;
insert into public.friendships(user_id,friend_id,status) values('52000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002','accepted');
set local role authenticated;
select is((public.get_profile_page('52000000-0000-0000-0000-000000000002')#>>'{rating_summary,total}')::integer,1,'accepted friend still cannot read private ratings in the summary');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000002')#>>'{rating_summary,average}')::numeric,10::numeric,'friend average excludes private scores');
select set_config('request.jwt.claims','{"sub":"52000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,total}')::integer,60,'public summary includes more than fifty visible ratings');
select is(public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,scope}','public','public scope is explicit');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,minimum}')::integer,9,'private minimum is not leaked to another user');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{profile,ratings_count}')::integer,60,'compatible profile count uses the same public scope');
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{profile,avg_rating}')::numeric,9::numeric,'compatible profile average does not disclose private scores');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_profile_page('52000000-0000-0000-0000-000000000001')#>>'{rating_summary,reviewed}')::integer,2,'anonymous summary excludes private reviews');
select ok(not (public.get_profile_page('52000000-0000-0000-0000-000000000001')->'rating_summary') ?| array['user_id','email','comment','is_admin','invite_code'],'summary contains counts only and no sensitive fields');
select * from finish();
rollback;
