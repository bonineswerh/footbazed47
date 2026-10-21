'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTicketIdentity}=require('../server/security/sync-ticket');
const {createHandler}=require('../api/sync-results');
const ticket='a'.repeat(64),run='91800000000000000';
test('database identity rejects malformed credentials and leagues before database access',async()=>{
  const identity=createTicketIdentity({supabase(){assert.fail('unexpected database read');}});
  for(const auth of [undefined,'Bearer fixture','Bearer '+ticket+'x','bearer '+ticket]){
    await assert.rejects(()=>identity(auth,{league:'PL'}),{status:403});
  }
  await assert.rejects(()=>identity('Bearer '+ticket,{league:'OTHER'}),{status:403});
});
test('database identity binds the one-time token to its league and rejects consumed/invalid results',async()=>{
  let response=JSON.stringify(run),calls=[];
  const identity=createTicketIdentity({async supabase(path,options){calls.push({path,...options});return {raw:response};}});
  assert.deepEqual(await identity('Bearer '+ticket,{league:'PL'}),{runId:run});
  assert.equal(calls[0].path,'/rest/v1/rpc/consume_match_sync_ticket');
  assert.deepEqual(calls[0].body,{p_token:ticket,p_league:'PL'});
  for(const value of [null,true,{},'1','9x']){
    response=JSON.stringify(value);
    await assert.rejects(()=>identity('Bearer '+ticket,{league:'PL'}),{status:403});
  }
});
test('database sync does not consume tickets in preview and uses the shared cooldown in production',async()=>{
  const old=process.env.VERCEL_ENV;const calls=[];
  const service={async supabase(path){calls.push(path);return {raw:path.includes('consume_')?JSON.stringify(run):'false'};},
    syncMatches(){assert.fail('cooldown must prevent import');}};
  const handler=createHandler({identity:createTicketIdentity(service),service});
  async function invoke(){let status,body;await handler({method:'POST',headers:{authorization:'Bearer '+ticket},query:{league:'PL'}},
    {status(v){status=v;},setHeader(){},end(v){body=JSON.parse(v);}});return {status,body};}
  try{
    process.env.VERCEL_ENV='preview';assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
    process.env.VERCEL_ENV='production';assert.deepEqual(await invoke(),{status:200,body:{status:'skipped',league:'PL'}});
    assert.deepEqual(calls,['/rest/v1/rpc/consume_match_sync_ticket','/rest/v1/rpc/claim_automatic_match_sync']);
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
