'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createApiFootballClient,quotaHeaders}=require('../server/football/api-football');

const headers={'x-ratelimit-requests-limit':'100','x-ratelimit-requests-remaining':'90','X-RateLimit-Limit':'10','X-RateLimit-Remaining':'9'};
const account={subscription:{plan:'Free',active:true},requests:{current:10,limit_day:100}};
const envelope=(response=[],paging={current:1,total:1})=>({errors:[],results:Array.isArray(response)?response.length:1,paging,response});
function mockClient(route=()=>({payload:envelope(account)}),options={}){
  const calls=[],destroyed=[];
  const transport={request(url,settings,callback){
    const req=new EventEmitter();req.destroy=()=>{destroyed.push(String(url));};
    req.end=()=>queueMicrotask(()=>{
      const call={url:new URL(url),settings};calls.push(call);
      const result=route(call,calls.length);
      if(result.network){req.emit('error',new Error('private-token transport error'));return;}
      if(result.noHeaders)return;
      const response=new EventEmitter();response.statusCode=result.status??200;response.headers=result.headers??headers;response.destroy=()=>{};
      callback(response);
      if(result.aborted){response.emit('aborted');return;}
      if(result.close){response.emit('close');return;}
      response.emit('data',Buffer.from(result.raw??JSON.stringify(result.payload??{})));
      if(!result.noEnd)response.emit('end');
    });return req;
  }};
  const client=createApiFootballClient({apiKey:'placeholder-test-secret',transport,...options});
  return {client,calls,destroyed};
}
const rejects=(promise,code)=>assert.rejects(promise,error=>error.code===code && !JSON.stringify(error).includes('private-token') && !error.message.includes('placeholder-test-secret'));

test('provider is server-only, uses the fixed origin and rejects arbitrary endpoints/parameters before transport',async()=>{
  const {client,calls}=mockClient();
  for(const [endpoint,params] of [['https://evil.test',{}],['/status',{key:'leak'}],['/fixtures',{page:0}],['/players',{season:'2024'}],['/fixtures',{from:'2026-02-30'}],['/leagues',{id:true}]])await rejects(client.get(endpoint,params),'invalid_provider_parameters');
  assert.equal(calls.length,0);
  const result=await client.accountStatus();assert.equal(result.plan,'Free');
  assert.equal(calls[0].url.origin,'https://v3.football.api-sports.io');assert.equal(calls[0].settings.headers['x-apisports-key'],'placeholder-test-secret');
  const missing=mockClient(undefined,{apiKey:''});await rejects(missing.client.accountStatus(),'provider_not_configured');assert.equal(missing.calls.length,0);
});

test('account diagnostics discard personal fields, arbitrary plan text and upstream fields',async()=>{
  for(const plan of ['Free','private-token','constructor']){
    const {client}=mockClient(()=>({payload:envelope({...account,account:{email:'private@example.test',key:'private-token'},subscription:{plan,active:true}})}));
    const result=await client.accountStatus();assert.equal(result.dailyRemaining,90);
    assert.equal(result.plan,plan==='Free'?'Free':'Другой тариф');assert.doesNotMatch(JSON.stringify(result),/private@|private-token|account|subscription/);
  }
  for(const value of [null,{...account,requests:{current:101,limit_day:100}},{...account,subscription:{plan:'Free',active:'true'}}]){
    const {client}=mockClient(()=>({payload:envelope(value)}));await rejects(client.accountStatus(),value===null?'provider_invalid_response':'provider_invalid_account');
  }
});

test('account metadata accepts the provider zero-result status wrapper without weakening collection validation',async()=>{
  for(const paging of [undefined,{current:1,total:1}]){
    const {client}=mockClient(()=>({payload:{errors:[],results:0,paging,response:account}}));
    const result=await client.accountStatus();assert.equal(result.plan,'Free');assert.equal(result.dailyLimit,100);
  }
  const broken=mockClient(()=>({payload:{errors:[],results:0,response:account}}));
  await rejects(broken.client.get('/leagues',{id:39}),'provider_invalid_response');
});

test('HTTP and API-level errors do not leak body text and never retry authentication or rate limits',async()=>{
  for(const [status,code]of [[401,'provider_access_denied'],[403,'provider_access_denied'],[429,'provider_rate_limit'],[302,'provider_http_error'],[204,'provider_http_error']]){
    const {client,calls}=mockClient(()=>({status,raw:'private-token'}),{retries:1});await rejects(client.get('/status'),code);assert.equal(calls.length,1);
  }
  for(const [errors,code]of [[{token:'private-token'},'provider_access_denied'],[{requests:'private-token'},'provider_rate_limit'],[{season:'private-token'},'provider_api_error'],[['private-token'],'provider_api_error']]){
    const {client}=mockClient(()=>({payload:{...envelope(),errors}}));await rejects(client.get('/leagues',{id:39}),code);
  }
});

test('malformed, truncated and oversized upstream responses fail without returning partial items',async()=>{
  const cases=[{raw:'not-json'}, {payload:{...envelope(),errors:null}}, {payload:{...envelope(),response:{}}}, {payload:{...envelope([{id:1}]),results:0}}, {payload:{...envelope(),paging:{current:1,total:0}}}, {payload:envelope([null])}];
  for(const result of cases){const {client}=mockClient(()=>result);await rejects(client.get('/leagues',{id:39}),'provider_invalid_response');}
  for(const field of ['aborted','close']){const {client}=mockClient(()=>({[field]:true}));await rejects(client.get('/status'),'provider_incomplete_response');}
  const large=mockClient(()=>({raw:'x'.repeat(300)}),{maxResponseBytes:100});await rejects(large.client.get('/status'),'provider_response_too_large');assert.equal(large.destroyed.length,1);
});

test('an absolute timeout covers missing headers and a body that never finishes',async()=>{
  for(const result of [{noHeaders:true},{payload:envelope(account),noEnd:true}]){
    const {client,destroyed}=mockClient(()=>result,{timeoutMs:20});await rejects(client.accountStatus(),'provider_timeout');assert.equal(destroyed.length,1);
  }
});

test('pagination follows all declared pages within request budget and reports actual quota metadata',async()=>{
  const {client,calls}=mockClient(call=>{const page=Number(call.url.searchParams.get('page')||1);return {payload:envelope([{id:page}],{current:page,total:3})};});
  const result=await client.collection('/players',{league:39,season:2024},{maxPages:3});
  assert.deepEqual(result.items.map(item=>item.id),[1,2,3]);assert.equal(calls.length,3);assert.equal(result.pages,3);assert.equal(result.quota.dailyRemaining,90);
  assert.equal(calls[2].url.searchParams.get('page'),'3');
});

test('insufficient quota, unknown headers and page caps stop before fetching a partial catalogue',async()=>{
  for(const [options,responseHeaders,code]of [[{requestBudget:1},headers,'provider_request_budget'],[{}, {...headers,'x-ratelimit-requests-remaining':'11'},'provider_quota_reserve'],[{}, {},'provider_quota_unknown']]){
    const {client,calls}=mockClient(()=>({headers:responseHeaders,payload:envelope([{id:1}],{current:1,total:3})}),options);
    await rejects(client.collection('/players',{league:39},{maxPages:3}),code);assert.equal(calls.length,1);
  }
  const capped=mockClient(()=>({payload:envelope([{id:1}],{current:1,total:5})}));await rejects(capped.client.collection('/players',{}, {maxPages:2}),'provider_pagination_limit');assert.equal(capped.calls.length,1);
});

test('inconsistent paging, disappearing pages and item limits cannot be mistaken for a complete collection',async()=>{
  const scenarios=[{payload:envelope([{id:2}],{current:1,total:2}),code:'provider_invalid_pagination'},{payload:envelope([{id:2}],{current:2,total:3}),code:'provider_incomplete_collection'},{payload:envelope([],{current:2,total:2}),code:'provider_incomplete_collection'}];
  for(const scenario of scenarios){const {client}=mockClient((_,n)=>({payload:n===1?envelope([{id:1}],{current:1,total:2}):scenario.payload}));await rejects(client.collection('/players'),scenario.code);}
  const {client}=mockClient(()=>({payload:envelope([{id:1},{id:2}])}));await rejects(client.collection('/players',{}, {maxItems:1}),'provider_pagination_limit');
});

test('retries are opt-in, bounded and consume the same request/quota budget',async()=>{
  const disabled=mockClient(()=>({status:503,raw:'private-token'}));await rejects(disabled.client.get('/status'),'provider_temporary_error');assert.equal(disabled.calls.length,1);
  const enabled=mockClient((_,n)=>n===1?{status:503,raw:'private-token'}:{payload:envelope(account)},{retries:1});assert.equal((await enabled.client.accountStatus()).plan,'Free');assert.equal(enabled.calls.length,2);
  const noBudget=mockClient(()=>({status:503}),{retries:1,requestBudget:1});await rejects(noBudget.client.get('/status'),'provider_request_budget');assert.equal(noBudget.calls.length,1);
});

test('competition diagnostics preserve missing coverage as null and never substitute provider IDs for internal IDs',async()=>{
  const {client}=mockClient(()=>({payload:envelope([{league:{id:39,name:'Premier League'},seasons:[{year:2024,coverage:{players:true,fixtures:{lineups:false}}}]}])}));
  const result=await client.competitionStatus('PL',2024);assert.equal(result.providerId,39);assert.equal(result.id,undefined);assert.deepEqual(result.coverage,{players:true,lineups:false,events:null,playerStatistics:null});
  const empty=mockClient(()=>({payload:envelope()}));assert.equal((await empty.client.competitionStatus('PL',2024)).available,false);
  const malformed=mockClient(()=>({payload:envelope([{league:{id:39,name:'Premier League'},seasons:[]}])}));await rejects(malformed.client.competitionStatus('PL',2024),'provider_invalid_coverage');
});

test('quota parsing accepts header case variations but rejects negative, boolean and malformed numbers',()=>{
  assert.deepEqual(quotaHeaders({'X-RateLimit-Requests-Remaining':'12','x-ratelimit-remaining':'0','retry-after':'60'}),{dailyLimit:null,dailyRemaining:12,minuteLimit:null,minuteRemaining:0,retryAfterSeconds:60});
  for(const value of ['-1','',true,'ten','1.5'])assert.equal(quotaHeaders({'x-ratelimit-remaining':value}).minuteRemaining,null);
});
