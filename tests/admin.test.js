'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {EventEmitter}=require('node:events');
const vm=require('node:vm');

function api({admin=true,authStatus=200,apiFootballKey='football-api-test-placeholder',route=()=>({data:{}})}={}){
  const calls=[];
  const https={request(url,options,callback){
    url=String(url);
    const request=new EventEmitter();let body;
    request.setTimeout=()=>{};request.write=value=>{body=value;};request.destroy=error=>request.emit('error',error);
    request.end=()=>queueMicrotask(()=>{
      const call={url,method:options.method||'GET',headers:options.headers,body:body?JSON.parse(body):undefined};calls.push(call);
      const result=url.endsWith('/auth/v1/user')?{status:authStatus,data:{id:'12000000-0000-0000-0000-000000000001'}}
        :url.includes('/rest/v1/users?id=')?{data:[{id:'12000000-0000-0000-0000-000000000001',is_admin:admin}]}
        :route(call);
      const response=new EventEmitter();response.statusCode=result.status||200;response.headers=result.headers||{};response.setEncoding=()=>{};
      callback(response);response.emit('data',JSON.stringify(result.data));response.emit('end');
    });
    return request;
  }};
  const env={SUPABASE_URL:'https://database.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key',FOOTBALL_DATA_API_KEY:'provider-test-key',API_FOOTBALL_KEY:apiFootballKey};
  const providerContext={module:{exports:{}},require:name=>{assert.equal(name,'node:https');return https;},process:{env},Buffer,URL,setTimeout,clearTimeout};
  vm.runInNewContext(readFileSync(join(__dirname,'../server/football/api-football.js'),'utf8'),providerContext);
  const context={module:{exports:{}},require:name=>{if(name==='../server/football/api-football')return providerContext.module.exports;assert.equal(name,'https');return https;},process:{env},Buffer,URL,URLSearchParams,console:{error(){}}};
  vm.runInNewContext(readFileSync(join(__dirname,'../api/admin.js'),'utf8'),context);
  return {calls,async send(body,{method='POST',authorization='Bearer user-test-token',raw=false}={}){
    const headers={};let result;
    const req={method,headers:{authorization},query:{},body:raw?JSON.stringify(body):body};
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
  const app=api();await app.send(undefined,{method:'GET'});
  assert.equal(app.calls[0].headers.Authorization,'Bearer user-test-token');
  assert.match(app.calls[1].url,/select=id,is_admin/);
  assert.equal(app.calls[1].headers.Authorization,'Bearer server-only-test-key');
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
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{matches:[match,match]}}:call.url.includes('/clubs?')?{data:[{id:20,external_id:2},{id:30,external_id:3}]}:{data:{}}});
  for(let i=0;i<2;i++)assert.equal((await app.send({action:'sync_matches',league:'PL',dateFrom:'2026-09-24',dateTo:'2026-09-25'})).body.processed,1);
  const writes=app.calls.filter(call=>call.url.includes('/rest/v1/matches?')&&call.method==='POST');
  assert.equal(writes.length,2);writes.forEach(call=>{assert.match(call.url,/on_conflict=external_id/);assert.equal(call.body.length,1);assert.equal(call.body[0].home_club_id,20);assert.match(call.headers.Prefer,/merge-duplicates/);});
});
test('squad duplicates are deduplicated on the existing name/team contract',async()=>{
  const player={name:'Player',position:'Goalkeeper'};
  const app=api({route:call=>call.url.includes('football-data.org')?{data:{teams:[{id:2,name:'Team',squad:[player,player]}]}}:call.url.includes('/clubs?')?{data:[{id:20,external_id:2}]}:{data:{}}});
  assert.equal((await app.send({action:'sync_squads',league:'PL'})).body.processed,1);
  const write=app.calls.find(call=>call.url.includes('/players?'));assert.match(write.url,/on_conflict=name,team/);assert.equal(write.body[0].club_id,20);
});
test('malformed provider collections fail before any database import',async()=>{
  for(const [action,data]of [['sync_matches',{}],['sync_matches',{matches:[{id:1}]}],['sync_squads',{teams:[{id:2,name:'Team'}]}]]){
    const app=api({route:()=>({data})});
    assert.equal((await app.send({action,league:'PL',dateFrom:'2026-09-24',dateTo:'2026-09-25'})).status,502);
    assert.equal(app.calls.some(call=>call.method==='POST'),false);
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
