'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {verifySyncIdentity,AUDIENCE,WORKFLOW}=require('../server/security/sync-identity');
const {createHandler}=require('../api/sync-results');
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'test',alg:'RS256',use:'sig'};
const now=1800000000;
const claims={iss:'https://token.actions.githubusercontent.com',aud:AUDIENCE,repository:'bonineswerh/footbazed47',repository_id:'1161780183',repository_owner_id:'261181787',ref:'refs/heads/main',workflow_ref:WORKFLOW,sub:'repo:bonineswerh/footbazed47:ref:refs/heads/main',event_name:'schedule',run_id:'123456',iat:now,nbf:now,exp:now+300};
function token(overrides={},header={}){
  const body=[{alg:'RS256',kid:'test',...header},{...claims,...overrides}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  return `Bearer ${body}.${sign('RSA-SHA256',Buffer.from(body),pair.privateKey).toString('base64url')}`;
}
const options={now,keys:async()=>[jwk]};
test('sync identity requires a real signature and the exact production workflow',async()=>{
  assert.deepEqual(await verifySyncIdentity(token(),options),{runId:'123456'});
  await assert.rejects(()=>verifySyncIdentity(token().slice(0,-12)+'tampered',options),/sync_identity_denied/);
  for(const change of [{aud:'other'},{repository_id:'1'},{repository_owner_id:'1'},{ref:'refs/heads/feature/a'},{workflow_ref:WORKFLOW.replace('sync-results','ci')},{event_name:'pull_request'},{exp:now-1},{iat:now-601},{nbf:now+60},{sub:'repo:another/repo:ref:refs/heads/main'},{run_id:'../1'}]){
    await assert.rejects(()=>verifySyncIdentity(token(change),options),/sync_identity_denied/);
  }
  await assert.rejects(()=>verifySyncIdentity(token({}, {alg:'none'}),options),/sync_identity_denied/);
  await assert.rejects(()=>verifySyncIdentity(undefined,options),/sync_identity_denied/);
});
async function invoke(handler,req={}){
  let body,status;await handler({method:'POST',headers:{authorization:'Bearer fixture'},query:{league:'PL'},...req},{status(v){status=v;},setHeader(){},end(v){body=JSON.parse(v);}});
  return {status,body};
}
test('automatic sync rejects unauthenticated and preview calls before touching data',async()=>{
  const old=process.env.VERCEL_ENV;
  try{
    process.env.VERCEL_ENV='production';
    const handler=createHandler({service:{supabase(){assert.fail('must not access database');}}});
    assert.equal((await invoke(handler)).status,403);
    process.env.VERCEL_ENV='preview';
    assert.equal((await invoke(handler)).status,503);
    assert.equal((await invoke(handler,{method:'GET'})).status,405);
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
test('automatic sync claims once, uses a bounded server date window and logs outcome',async()=>{
  const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
  const calls=[];let claimed=true;
  const service={async supabase(path,options){calls.push({path,...options});return {raw:JSON.stringify(claimed)};},
    async syncMatches(input){calls.push(input);return {...input,processed:3};},
    async recordAdminAction(actor,action,details){calls.push({actor,action,details});return true;}};
  const handler=createHandler({identity:async()=>({runId:'123'}),service,now:()=>new Date('2026-10-20T12:00:00Z')});
  try{
    assert.deepEqual(await invoke(handler),{status:200,body:{status:'updated',league:'PL',processed:3}});
    assert.deepEqual(calls[1],{league:'PL',dateFrom:'2026-10-18',dateTo:'2026-10-27'});
    assert.equal(calls[2].action,'auto_sync_succeeded');
    assert.equal(calls[2].actor,null);
    claimed=false;calls.length=0;
    assert.equal((await invoke(handler)).body.status,'skipped');assert.equal(calls.length,1);
    assert.equal((await invoke(handler,{query:{league:'OTHER'}})).status,400);
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
test('provider errors are audited without leaking tokens or provider payloads',async()=>{
  const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';let audit;
  try{
    const handler=createHandler({identity:async()=>({runId:'123'}),service:{
      async supabase(){return {raw:'true'};},
      async syncMatches(){throw Object.assign(new Error('sensitive provider body'),{status:429});},
      async recordAdminAction(actor,action,details){audit={action,details};return true;}
    }});
    assert.deepEqual(await invoke(handler),{status:429,body:{error:'sync_unavailable'}});
    assert.equal(audit.action,'auto_sync_failed');assert.equal(audit.details.metadata.status,429);
    assert.ok(!JSON.stringify(audit).includes('sensitive'));
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
test('malformed claim responses fail closed instead of reporting a skipped success',async()=>{
  const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
  try{
    for(const raw of ['null','{}','"true"','invalid']){
      const handler=createHandler({identity:async()=>({runId:'123'}),service:{
        async supabase(){return {raw};},
        async syncMatches(){assert.fail('malformed claim must not import');},
        async recordAdminAction(){return true;}
      }});
      assert.equal((await invoke(handler)).status,503);
    }
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
