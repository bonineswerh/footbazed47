'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {EventEmitter}=require('node:events');
const vm=require('node:vm');

function bearer(overrides={}){
  const now=Math.floor(Date.now()/1000);
  const claims={sub:'12000000-0000-0000-0000-000000000001',session_id:'12000000-0000-0000-0000-000000000002',iss:'https://database.example.test/auth/v1',aud:'authenticated',role:'authenticated',aal:'aal2',iat:now,exp:now+3600,amr:[{method:'totp',timestamp:now}],...overrides};
  return `Bearer ${Buffer.from('{"alg":"ES256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test-signature`;
}
function api({admin=true,authStatus=200,sessionState={active:true,aal:'aal2',factor_verified:true},sessionStatus=200,apiFootballKey='football-api-test-placeholder',route=()=>({data:[]})}={}){
  const calls=[];
  const https={request(url,options,callback){
    url=String(url);
    const request=new EventEmitter();let body;
    request.setTimeout=()=>{};request.write=value=>{body=value;};request.destroy=error=>request.emit('error',error);
    request.end=()=>queueMicrotask(()=>{
      const call={url,method:options.method||'GET',headers:options.headers,body:body?JSON.parse(body):undefined};calls.push(call);
      const result=url.endsWith('/auth/v1/user')?{status:authStatus,data:{id:'12000000-0000-0000-0000-000000000001'}}
        :url.includes('/rest/v1/users?id=')?{data:[{id:'12000000-0000-0000-0000-000000000001',is_admin:admin}]}
        :url.includes('/rpc/admin_auth_session_state?')?{status:sessionStatus,data:sessionState}
        :route(call);
      const response=new EventEmitter();response.statusCode=result.status||200;response.headers=result.headers||{};response.setEncoding=()=>{};
      callback(response);response.emit('data',JSON.stringify(result.data));response.emit('end');
    });
    return request;
  }};
  const env={SUPABASE_URL:'https://database.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key',FOOTBALL_DATA_API_KEY:'provider-test-key',API_FOOTBALL_KEY:apiFootballKey};
  const providerContext={module:{exports:{}},require:name=>{assert.equal(name,'node:https');return https;},process:{env},Buffer,URL,setTimeout,clearTimeout};
  vm.runInNewContext(readFileSync(join(__dirname,'../server/football/api-football.js'),'utf8'),providerContext);
  const emblemContext={module:{exports:{}},require:name=>{assert.equal(name,'./api-football');return providerContext.module.exports;}};
  vm.runInNewContext(readFileSync(join(__dirname,'../server/football/club-emblems.js'),'utf8'),emblemContext);
  const lineupContext={module:{exports:{}},require:name=>{assert.equal(name,'./api-football');return providerContext.module.exports;}};
  vm.runInNewContext(readFileSync(join(__dirname,'../server/football/match-lineups.js'),'utf8'),lineupContext);
  const context={module:{exports:{}},require:name=>{if(['../server/security/admin-session','../server/football/catalog-status'].includes(name))return require(name);if(name==='../server/football/api-football')return providerContext.module.exports;if(name==='../server/football/club-emblems')return emblemContext.module.exports;if(name==='../server/football/match-lineups')return lineupContext.module.exports;assert.equal(name,'https');return https;},process:{env},Buffer,URL,URLSearchParams,console:{error(){}}};
  vm.runInNewContext(readFileSync(join(__dirname,'../api/admin.js'),'utf8'),context);
  return {calls,async send(body,{method='POST',authorization=bearer(),raw=false,query={}}={}){
    const headers={};let result;
    const req={method,headers:{authorization},query,body:raw?JSON.stringify(body):body};
    const res={status(code){this.statusCode=code;},setHeader(key,value){headers[key]=value;},end(value){result={status:this.statusCode,headers,body:JSON.parse(value)};}};
    await context.module.exports(req,res);return result;
  }};
}

test('admin API rejects missing, invalid and non-admin identity before privileged operations',async()=>{
  for(const scenario of [{authorization:''},{authStatus:401},{admin:false}]){
    const app=api(scenario);const response=await app.send({action:'cleanup_development_data',scope:'all',confirmation:'DELETE FOOTBAZED DATA'},scenario);
    assert.equal(response.status,403);assert.equal(app.calls.some(call=>call.method==='POST'),false);
    assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(response.headers['X-Content-Type-Options'],'nosniff');
  }
});
test('admin reads verify the bearer token and protected database role independently',async()=>{
  const app=api(),authorization=bearer();await app.send(undefined,{method:'GET',authorization});
  assert.equal(app.calls[0].headers.Authorization,authorization);
  assert.match(app.calls[1].url,/select=id,is_admin/);
  assert.equal(app.calls[1].headers.Authorization,'Bearer server-only-test-key');
});

test('AAL1 has only safe setup status, never administrative reads, writes or provider access',async()=>{
  const app=api({sessionState:{active:true,aal:'aal1',factor_verified:false}}),authorization=bearer({aal:'aal1'});
  const access=await app.send(undefined,{method:'GET',authorization,query:{action:'access_status'}});
  assert.deepEqual(access.body,{mfaRequired:true});
  assert.equal(app.calls.length,3); // Auth, protected role, narrow session metadata only
  assert.equal((await app.send(undefined,{method:'GET',authorization})).body.code,'admin_mfa_required');
  for(const action of ['community_experts','moderation_queue','review_community_report','api_football_status','api_football_competition','prepare_missing_club_emblem','prepare_club_emblems','prepare_match_lineup','apply_match_lineup','apply_club_emblems','rollback_club_emblems','prepare_catalog','audit_history','sync_matches','sync_squads','update_match','migrate_legacy_avatars','cleanup_development_data','test_connection']){
    const result=await app.send({action}, {authorization});assert.equal(result.status,403,action);assert.equal(result.body.code,'admin_mfa_required',action);
  }
  assert.equal(app.calls.some(c=>c.method!=='GET'||c.url.includes('api-sports.io')||c.url.includes('football-data.org')),false);
  assert.equal(app.calls.some(c=>/\/rest\/v1\/(matches|players|ratings|admin_audit_logs)/.test(c.url)),false);
});
test('signed identity must match issuer, user, audience, expiry and session before MFA',async()=>{
  const now=Math.floor(Date.now()/1000);
  for(const claims of [{iss:'https://attacker.test/auth/v1'},{sub:'forged-user'},{aud:'service_role'},{role:'service_role'},{exp:now-1},{iat:now+120},{session_id:'invalid'},{aal:'forged'}]){
    const app=api(),result=await app.send({action:'sync_matches'},{authorization:bearer(claims)});
    assert.equal(result.status,403);assert.equal(result.body.code,'admin_session_invalid');assert.equal(app.calls.length,2);
  }
  const invalid=api({authStatus:401});await invalid.send({action:'cleanup_development_data'},{authorization:bearer()});
  assert.equal(invalid.calls.length,1); // Auth signature validation cannot be skipped by forged claims.
});
test('deleted or expired session and disconnected factor reject stale AAL2 tokens',async()=>{
  for(const [sessionState,code] of [[{active:false,aal:'aal2',factor_verified:true},'admin_session_invalid'],[{active:true,aal:'aal1',factor_verified:true},'admin_mfa_required'],[{active:true,aal:'aal2',factor_verified:false},'admin_mfa_required']]){
    const app=api({sessionState}),result=await app.send({action:'update_match'});
    assert.equal(result.status,403);assert.equal(result.body.code,code);assert.equal(app.calls.length,3);
  }
  const unavailable=api({sessionStatus:503}),result=await unavailable.send({action:'sync_matches'});
  assert.equal(result.status,503);assert.equal(unavailable.calls.some(c=>c.method==='POST'),false);
});
test('cleanup requires recent TOTP even with active AAL2, never trusts password or future timestamps',async t=>{
  const now=1790000000;
  t.mock.method(Date,'now',()=>now*1000);
  for(const amr of [[],null,{},[{method:'totp',timestamp:now-301}],[{method:'password',timestamp:now}],[{method:'totp',timestamp:now+1}]]){
    const app=api(),result=await app.send({action:'cleanup_development_data',scope:'ratings',confirmation:'DELETE FOOTBAZED DATA'},{authorization:bearer({amr})});
    assert.equal(result.status,403);assert.equal(result.body.code,'admin_mfa_recent_required');assert.equal(app.calls.some(c=>c.method==='POST'),false);
    assert.equal((await app.send(undefined,{method:'GET',authorization:bearer({amr})})).status,200); // Reading does not require a fresh code.
  }
  const app=api(),result=await app.send({action:'cleanup_development_data',scope:'ratings',confirmation:'DELETE FOOTBAZED DATA'},{authorization:bearer({amr:[{method:'totp',timestamp:now-299}]})});
  assert.equal(result.status,200);assert.equal(app.calls.filter(c=>c.url.endsWith('/rpc/admin_cleanup_development_data')).length,1);
});
test('expert roles require protected administrator identity and ignore client-supplied actor',async()=>{
  for(const scenario of [{authorization:''},{authStatus:401},{admin:false}]){
    const app=api(scenario);assert.equal((await app.send({action:'community_experts',username:'writer',enabled:true},scenario)).status,403);
    assert.equal(app.calls.some(c=>c.method==='POST'),false);
  }
  const app=api();await app.send({action:'community_experts',username:'writer',enabled:true,p_actor:'forged-user'});
  const rpc=app.calls.find(c=>c.url.endsWith('/rpc/admin_community_experts'));
  assert.equal(rpc.body.p_actor,'12000000-0000-0000-0000-000000000001');assert.equal(rpc.body.p_username,'writer');assert.equal(rpc.body.p_enabled,true);
  for(const input of [{enabled:'true'},{username:[]},{username:'a'.repeat(31)}])assert.equal((await app.send({action:'community_experts',...input})).status,400);
  assert.equal(app.calls.filter(c=>c.method==='POST').length,1);
});

test('moderation queue and decisions derive actor only from verified administrator',async()=>{
  const app=api(),report_id='55000000-0000-4000-8000-000000000001';
  await app.send({action:'moderation_queue',status:'open',target_type:'comment',offset:20,p_actor:'forged',limit:99999});
  assert.deepEqual(app.calls.at(-1).body,{p_actor:'12000000-0000-0000-0000-000000000001',p_status:'open',p_target_type:'comment',p_offset:20,p_limit:20});
  await app.send({action:'review_community_report',report_id,status:'dismissed',note:'  No violation found.  ',p_actor:'forged',snapshot:{email:'forged'}});
  assert.deepEqual(app.calls.at(-1).body,{p_actor:'12000000-0000-0000-0000-000000000001',p_report_id:report_id,p_status:'dismissed',p_note:'No violation found.'});
  assert.equal(app.calls.some(c=>c.url.includes('api-sports.io')||c.url.includes('/rest/v1/community_reports')),false);
  assert.equal(app.calls.some(c=>c.url.includes('/rest/v1/admin_audit_logs')),false); // audit is atomic inside the SQL decision
});
test('moderation rejects non-admin requests and malformed decisions before any privileged RPC',async()=>{
  for(const scenario of [{authorization:''},{authStatus:401},{admin:false}]){
    const app=api(scenario);
    for(const action of ['moderation_queue','review_community_report'])assert.equal((await app.send({action},scenario)).status,403);
    assert.equal(app.calls.some(c=>c.method==='POST'),false);
  }
  const app=api(),report_id='55000000-0000-4000-8000-000000000001';
  for(const body of [{status:'forged'},{target_type:'users;delete'},{offset:-1},{offset:'20'},{offset:1.1},{offset:1000001}])assert.equal((await app.send({action:'moderation_queue',...body})).status,400);
  for(const body of [{report_id:'invalid',status:'reviewed',note:'A valid long note.'},{report_id,status:'open',note:'A valid long note.'},{report_id,status:'reviewed',note:'short'},{report_id,status:'reviewed',note:'x'.repeat(1001)}])assert.equal((await app.send({action:'review_community_report',...body})).status,400);
  assert.equal(app.calls.some(c=>c.method==='POST'),false);
});

test('API-Football diagnostics require administrator identity and never import catalogue rows',async()=>{
  const data={errors:[],results:1,paging:{current:1,total:1},response:{account:{email:'private@example.test'},subscription:{plan:'Free',active:true},requests:{current:3,limit_day:100}}};
  for(const scenario of [{authorization:''},{authStatus:401},{admin:false}]){
    const app=api(scenario);assert.equal((await app.send({action:'api_football_status'},scenario)).status,403);
    assert.equal(app.calls.some(c=>c.url.includes('api-sports.io')),false);
  }
  const app=api({route:()=>({data})}),result=await app.send({action:'api_football_status'});
  assert.equal(result.status,200);assert.equal(result.body.plan,'Free');assert.equal(result.body.dailyRemaining,97);
  const provider=app.calls.find(c=>c.url.includes('api-sports.io'));
  assert.equal(provider.headers['x-apisports-key'],'football-api-test-placeholder');
  assert.equal(provider.url,'https://v3.football.api-sports.io/status');
  assert.equal(app.calls.some(c=>c.method!=='GET'),false);
  assert.doesNotMatch(JSON.stringify(result),/private@|football-api-test-placeholder|account|limit_day/);
});

test('API-Football configuration metadata makes no upstream call and invalid season cannot reach provider',async()=>{
  const app=api(),overview=await app.send(undefined,{method:'GET'});
  assert.equal(overview.body.apiFootballConfigured,true);assert.equal(app.calls.some(c=>c.url.includes('api-sports.io')),false);
  for(const body of [{league:'OTHER',season:2024},{league:'PL',season:'2024'},{league:'PL',season:1800}])assert.equal((await app.send({action:'api_football_competition',...body})).status,400);
  assert.equal(app.calls.some(c=>c.url.includes('api-sports.io')),false);
  const missing=api({apiFootballKey:''});const result=await missing.send({action:'api_football_status'});
  assert.equal(result.status,503);assert.equal(result.body.code,'provider_not_configured');
});

test('emblem preparation writes only the reviewed batch and apply accepts only a batch UUID',async()=>{
  const app=api({route:call=>call.url.includes('/clubs?')?{data:[{id:31,external_id:65,name:'Manchester City FC',short_name:'Man City',area_name:'England'}]}:call.url.includes('/club_provider_ids?')?{data:[]}:call.url.includes('api-sports.io')?{data:{errors:[],results:1,paging:{current:1,total:1},response:[{team:{id:50,name:'Manchester City',country:'England',logo:'https://media.api-sports.io/football/teams/50.png'}}]}}:{data:{batch:'12345678-1234-4123-8123-123456789012'}}});
  const prepared=await app.send({action:'prepare_club_emblems',league:'PL',season:2024});assert.equal(prepared.status,200);
  assert.equal(app.calls.filter(c=>c.url.includes('api-sports.io')).length,1);
  assert.equal(app.calls.filter(c=>c.method==='POST').length,1);
  const stage=app.calls.find(c=>c.url.includes('/rpc/admin_stage_club_emblems'));assert.equal(stage.body.p_items[0].provider_id,50);assert.equal(stage.body.p_actor,'12000000-0000-0000-0000-000000000001');
  for(const batch of ['',31,'http://evil.test'])assert.equal((await app.send({action:'apply_club_emblems',batch})).status,400);
  await app.send({action:'apply_club_emblems',batch:prepared.body.batch});
  assert.equal(app.calls.filter(c=>c.url.includes('api-sports.io')).length,1);assert.equal(app.calls.at(-1).body.p_batch,prepared.body.batch);
  const denied=api({admin:false});assert.equal((await denied.send({action:'prepare_club_emblems',league:'PL',season:2024})).status,403);assert.equal(denied.calls.some(c=>c.url.includes('api-sports.io')),false);
});
test('historical lineup actions reject missing admin, invalid IDs and forged payloads before provider calls',async()=>{
  const denied=api({admin:false});assert.equal((await denied.send({action:'prepare_match_lineup',match_id:1})).status,403);
  assert.equal(denied.calls.some(c=>c.url.includes('api-sports.io')),false);
  const app=api();
  for(const match_id of [null,-1,'1',1.5])assert.equal((await app.send({action:'prepare_match_lineup',match_id})).status,400);
  for(const batch of ['',1,'https://untrusted.test'])assert.equal((await app.send({action:'apply_match_lineup',batch})).status,400);
  const batch='16000000-0000-4000-8000-000000000001';
  await app.send({action:'apply_match_lineup',batch,payload:{fixture_id:9999},actor:'forged'});
  assert.deepEqual(app.calls.at(-1).body,{p_batch:batch,p_actor:'12000000-0000-0000-0000-000000000001'});
  assert.equal(app.calls.some(c=>c.url.includes('api-sports.io')),false);
});

test('missing-emblem lookup derives its query from an existing club and never trusts client provider IDs',async()=>{
  const app=api({route:call=>call.url.includes('/clubs?')?{data:[{id:31,external_id:65,name:'Manchester City FC',short_name:'Man City',area_name:'England',logo_asset_id:null}]}:call.url.includes('/club_provider_ids?')?{data:[]}:call.url.includes('api-sports.io')?{data:{errors:[],results:1,paging:{current:1,total:1},response:[{team:{id:50,name:'Manchester City',country:'England',national:false,logo:'https://media.api-sports.io/football/teams/50.png'}}]}}:{data:{batch:'12345678-1234-4123-8123-123456789012'}}});
  for(const club_id of [null,-1,'31',31.1])assert.equal((await app.send({action:'prepare_missing_club_emblem',club_id})).status,400);
  const result=await app.send({action:'prepare_missing_club_emblem',club_id:31,provider_id:999,search:'Forged Club',actor:'forged'});assert.equal(result.status,200);
  const provider=app.calls.filter(c=>c.url.includes('api-sports.io'));assert.equal(provider.length,1);assert.match(provider[0].url,/search=Man\+City$/);
  const stage=app.calls.find(c=>c.url.includes('/rpc/admin_stage_club_emblems'));assert.equal(stage.body.p_league,'CATALOG');assert.equal(stage.body.p_season,null);assert.equal(stage.body.p_items[0].provider_id,50);assert.equal(stage.body.p_actor,'12000000-0000-0000-0000-000000000001');
  const denied=api({admin:false});assert.equal((await denied.send({action:'prepare_missing_club_emblem',club_id:31})).status,403);assert.equal(denied.calls.some(c=>c.url.includes('api-sports.io')),false);
  const missing=api({route:()=>({data:[]})});assert.equal((await missing.send({action:'prepare_missing_club_emblem',club_id:31})).status,404);assert.equal(missing.calls.some(c=>c.url.includes('api-sports.io')),false);
});
test('unsupported API-Football season stops lineup import and returns a plan error without upstream text',async()=>{
  const app=api({route:call=>call.url.includes('/matches?')?{data:[{id:1,status:'finished',league_code:'PL',season:'2026',match_date:'2026-09-01T19:00:00Z',home_club_id:24,away_club_id:31}]}:
    call.url.includes('/club_provider_ids?')?{data:[{club_id:24,external_id:541},{club_id:31,external_id:50}]}:
    {data:{errors:{plan:'secret upstream detail'},results:0,paging:{current:1,total:1},response:[]}}});
  const result=await app.send({action:'prepare_match_lineup',match_id:1});
  assert.equal(result.status,502);assert.equal(result.body.code,'provider_plan_restricted');
  assert.doesNotMatch(JSON.stringify(result),/secret upstream|football-api-test-placeholder/);
  assert.equal(app.calls.filter(c=>c.url.includes('api-sports.io')).length,1);
  assert.equal(app.calls.some(c=>c.url.includes('/rpc/admin_stage_match_lineup')),false);
});
test('admin rejects unknown methods/actions and malformed or oversized parsed request bodies',async()=>{
  const app=api();assert.equal((await app.send({}, {method:'DELETE'})).status,405);
  for(const body of [[],null,'bad-json'])assert.equal((await app.send(body)).status,400);
  for(const raw of [false,true])assert.equal((await app.send({action:'test_connection',padding:'x'.repeat(33000)},{raw})).status,413);
  assert.equal((await app.send({action:'arbitrary_action'})).status,400);
  assert.equal(app.calls.some(call=>call.url.includes('football-data.org')),false);
});
test('cleanup requires an exact phrase and allowlisted scope at the server boundary',async()=>{
  const app=api();
  for(const body of [{scope:'all',confirmation:'yes'},{scope:'users',confirmation:'DELETE FOOTBAZED DATA'}]){
    assert.equal((await app.send({action:'cleanup_development_data',...body})).status,400);
  }
  assert.equal(app.calls.some(call=>call.url.includes('/rpc/admin_cleanup')),false);
  const response=await app.send({action:'cleanup_development_data',scope:'ratings',confirmation:'DELETE FOOTBAZED DATA'});
  assert.equal(response.status,200);
  assert.deepEqual(app.calls.find(call=>call.url.includes('/rpc/admin_cleanup')).body,{p_scope:'ratings',p_confirmation:'DELETE FOOTBAZED DATA'});
});
test('invalid calendar dates, score types and match timestamps cannot reach writes',async()=>{
  const app=api();
  for(const date of ['2026-02-30','2026-13-01','garbage'])assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:date,dateTo:'2026-03-10'})).status,400);
  assert.equal((await app.send({action:'update_match',id:1,status:'finished',homeScore:true,awayScore:0,matchDate:'2026-09-24T10:00:00Z'})).status,400);
  assert.equal((await app.send({action:'update_match',id:1,status:'finished',homeScore:1,awayScore:0,matchDate:null})).status,400);
  assert.equal(app.calls.some(call=>call.method!=='GET'),false);
});
test('provider and database failures do not disclose upstream text or credentials',async()=>{
  for(const status of [400,403,429,500]){
    const app=api({route:()=>({status,data:{message:'secret-token SQL internal detail'}})});
    const response=await app.send({action:'test_connection',league:'PL'});
    assert.ok(response.status>=400);assert.doesNotMatch(JSON.stringify(response),/secret-token|SQL|server-only-test-key|provider-test-key/);
  }
});
test('a repeated provider match is upserted once with a stable external identity',async()=>{
  const match={id:1,homeTeam:{id:2,name:'Home'},awayTeam:{id:3,name:'Away'},utcDate:'2026-09-24T19:00:00Z',status:'FINISHED',score:{fullTime:{home:2,away:1}}};
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[match,match]}}:call.url.includes('/competitions?')?{data:[{id:7}]}:call.url.includes('/clubs?')?{data:[{id:20,external_id:2},{id:30,external_id:3}]}:{data:{}}});
  for(let i=0;i<2;i++)assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-09-24',dateTo:'2026-09-25'})).body.processed,1);
  const writes=app.calls.filter(call=>call.url.includes('/rest/v1/matches?')&&call.method==='POST');
  assert.equal(writes.length,2);writes.forEach(call=>{assert.match(call.url,/on_conflict=external_id/);assert.equal(call.body.length,1);assert.equal(call.body[0].home_club_id,20);assert.equal(call.body[0].competition_id,7);assert.equal(Object.hasOwn(call.body[0],'season'),false);assert.match(call.headers.Prefer,/merge-duplicates/);});
});
test('squad duplicates are deduplicated on the existing name/team contract',async()=>{
  const player={name:'Player',position:'Goalkeeper'};
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{teams:[{id:2,name:'Team',squad:[player,player]}]}}:call.url.includes('/clubs?')?{data:[{id:20,external_id:2}]}:{data:{}}});
  assert.equal((await app.send({action:'sync_squads',league:'PL'})).body.processed,1);
  const write=app.calls.find(call=>call.url.includes('/players?'));assert.match(write.url,/on_conflict=name,team/);assert.equal(write.body[0].club_id,20);
});

test('calendar freshness and durable audit history are protected, sanitized and do not call providers',async()=>{
  const logs=Array.from({length:21},(_,i)=>({id:40-i,action:'sync_matches',target_type:'league',target_id:'PL',created_at:'2026-10-07T14:00:00Z',actor_id:'private-actor',metadata:{processed:5,dateFrom:'2026-10-01',dateTo:'2026-10-07',key:'private-key',note:'private-note'}}));
  const app=api({route:call=>call.url.includes('/admin_audit_logs?')?{data:logs}:call.url.includes('select=match_date')?{data:[{match_date:'2026-09-20T18:00:00Z'}]}:{data:[],headers:{'content-range':'0-0/3'}}});
  const overview=await app.send(undefined,{method:'GET'});
  assert.equal(overview.status,200);assert.equal(overview.body.freshness.confirmedLineups,3);assert.equal(overview.body.freshness.overdueMatches,3);
  assert.equal(overview.body.freshness.latestImport.league,'PL');assert.equal(overview.body.activity.items.length,20);
  assert.ok(app.calls.some(c=>c.url.includes('/match_lineups?select=match_id')));
  const older=await app.send({action:'audit_history',before_id:21});assert.equal(older.status,200);assert.match(app.calls.at(-1).url,/id=lt\.21/);
  assert.doesNotMatch(JSON.stringify(overview),/private-actor|private-key|private-note/);
  assert.equal(app.calls.some(c=>c.url.includes('football-data.org')||c.url.includes('api-sports.io')||c.method!=='GET'),false);
  for(const before_id of ['21',-1,1.5,'1&select=*'])assert.equal((await app.send({action:'audit_history',before_id})).status,400);
  const denied=api({admin:false});assert.equal((await denied.send({action:'audit_history'})).status,403);assert.equal(denied.calls.some(c=>c.url.includes('admin_audit_logs')),false);
});
test('calendar import rejects mismatched fixtures and results before writing football entities',async()=>{
  const base={id:1,homeTeam:{id:2,name:'Home'},awayTeam:{id:3,name:'Away'},utcDate:'2026-10-01T19:00:00Z',status:'FINISHED',score:{fullTime:{home:2,away:1}}};
  const invalid=[{...base,awayTeam:base.homeTeam},{...base,status:'UNKNOWN'},{...base,utcDate:'2026-09-20T19:00:00Z'},{...base,score:{fullTime:{home:null,away:1}}},{...base,score:{fullTime:{home:1.5,away:1}}}];
  for(const match of invalid){
    const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[match]}}:{data:[]}});
    assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'})).status,502);
    assert.equal(app.calls.some(c=>c.method==='POST'&&!c.url.includes('/admin_audit_logs')),false);
  }
  for(const payload of [{competition:{code:'PD'},matches:[base]},{matches:[base,{...base,status:'LIVE'}]}]){
    const app=api({route:()=>({data:payload})});assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'})).status,502);
    assert.equal(app.calls.some(c=>c.method==='POST'&&!c.url.includes('/admin_audit_logs')),false);
  }
});
test('calendar import refuses absent competition identity and records rate limits without upstream details',async()=>{
  const base={id:1,homeTeam:{id:2,name:'Home'},awayTeam:{id:3,name:'Away'},utcDate:'2026-10-01T19:00:00Z',status:'TIMED'};
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[base]}}:{data:[]}});
  assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'})).status,502);
  assert.equal(app.calls.some(c=>c.url.includes('/clubs?')),false);
  const limited=api({route:call=>call.url.includes('football-data.org')?{status:429,data:{message:'secret upstream key'}}:{data:[]}});
  assert.equal((await limited.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'})).status,429);
  assert.deepEqual(limited.calls.find(c=>c.method==='POST').body.metadata,{status:429});
  assert.doesNotMatch(JSON.stringify(limited.calls.find(c=>c.method==='POST').body),/secret/);
});
test('successful empty calendar checks record their exact league and dates without claiming imported rows',async()=>{
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[]}}:{data:[]}});
  const response=await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'});
  assert.equal(response.body.processed,0);assert.equal(response.body.auditRecorded,true);
  assert.deepEqual(app.calls.find(c=>c.method==='POST').body.metadata,{processed:0,dateFrom:'2026-10-01',dateTo:'2026-10-02'});
  assert.equal(app.calls.some(c=>c.url.includes('/clubs?')||c.url.includes('/competitions?')),false);
});
test('a failed audit append does not report a successful match import as a failed data write',async()=>{
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[]}}:call.url.includes('/admin_audit_logs')?{status:500,data:{message:'private database detail'}}:{data:[]}});
  const response=await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-10-01',dateTo:'2026-10-02'});
  assert.equal(response.status,200);assert.equal(response.body.processed,0);assert.equal(response.body.auditRecorded,false);
  assert.doesNotMatch(JSON.stringify(response),/private database detail/);
});
test('squad imports preserve general positions without inventing specific player roles',async()=>{
  const squad=['Goalkeeper','Defence','Midfield','Offence','Centre-Back','New role'].map((position,index)=>({name:'Player '+index,position}));
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{teams:[{id:2,name:'Team',squad}]}}:call.url.includes('/clubs?')?{data:[{id:20,external_id:2}]}:{data:{}}});
  assert.equal((await app.send({action:'sync_squads',league:'PL'})).body.processed,6);
  const rows=app.calls.find(call=>call.url.includes('/players?')).body;
  assert.deepEqual(rows.map(row=>row.position),['GK','DF','MF','FW','CB','New role']);
});
test('malformed provider collections fail before any database import',async()=>{
  for(const [action,data]of [['sync_matches',{}],['sync_matches',{matches:[{id:1}]}],['sync_squads',{teams:[{id:2,name:'Team'}]}]]){
    const app=api({route:()=>({data})});
    assert.equal((await app.send({action,league:'PL',dateFrom:'2026-09-24',dateTo:'2026-09-25'})).status,502);
    assert.equal(app.calls.some(call=>call.method==='POST'&&!call.url.includes('/admin_audit_logs')),false);
  }
});

test('catalogue reset requires a prepared batch and uses the protected transaction',async()=>{
  const app=api(),base={action:'cleanup_development_data',scope:'all',confirmation:'DELETE FOOTBAZED DATA'};
  assert.equal((await app.send(base)).status,400);
  assert.equal((await app.send({...base,batch:'not-a-batch'})).status,400);
  const batch='14000000-0000-4000-8000-000000000001';
  assert.equal((await app.send({...base,batch})).status,200);
  assert.deepEqual(app.calls.find(c=>c.url.endsWith('/rpc/admin_apply_prepared_catalog')).body,{p_batch:batch,p_confirmation:base.confirmation});
});

test('catalogue preparation validates both provider collections and writes only staging',async()=>{
  const teams=[{id:2,name:'Home',clubColors:'Blue / White',squad:[{id:9,name:'Player',position:'Goalkeeper'}]},{id:3,name:'Away',squad:[]}];
  const matches=[{id:1,homeTeam:teams[0],awayTeam:teams[1],utcDate:'2026-09-24T19:00:00Z',status:'FINISHED',score:{fullTime:{home:2,away:1}}}];
  const body={action:'prepare_catalog',batch:'14000000-0000-4000-8000-000000000001',league:'PL',dateFrom:'2026-09-01',dateTo:'2026-10-10'};
  const app=api({route:c=>({data:c.url.includes('/matches?')?{matches,competition:{id:2021}}:c.url.includes('/teams')?{teams}:{} })});
  assert.equal((await app.send(body)).status,200);
  const stage=app.calls.find(c=>c.url.endsWith('/rpc/admin_stage_catalog'));
  assert.equal(stage.body.p_payload.players[0].metadata.external_id,9);
  assert.equal(stage.body.p_payload.clubs[0].club_colors,'Blue / White');
  assert.equal(app.calls.some(c=>/\/rest\/v1\/(matches|players|clubs)\?/.test(c.url)),false);
  const broken=api({route:c=>({data:c.url.includes('/matches?')?{matches}: {teams:[]}})});
  assert.equal((await broken.send(body)).status,502);
  assert.equal(broken.calls.some(c=>c.method==='POST'),false);
});
