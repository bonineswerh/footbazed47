'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const commit='a'.repeat(40);
function fixture(patch={}){
  const shell='<nav id="mainNav"></nav><script src="app.js?v=test"></script><link href="styles.css?v=test">';
  const calls=[];
  return {calls,fetcher:async(url,options)=>{
    assert.ok(url.startsWith('https://footbazed47.vercel.app/'));calls.push({url,options});
    const path=new URL(url).pathname;
    if(patch.reject)throw new Error('secret upstream body');
    const body=path==='/release.json'?JSON.stringify({verified:true,commit,qualityRunId:17,...patch.release}):
      path.startsWith('/api/')?'{}':patch.shell??shell;
    const type=path.endsWith('.json')||path.startsWith('/api/')?'application/json':
      path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html';
    return {status:patch.status??(path==='/api/admin'?403:200),
      headers:new Headers({'content-type':type,'content-security-policy':patch.policy??"default-src 'self'; script-src 'self'; script-src-attr 'none'"}),
      text:async()=>body,json:async()=>JSON.parse(body)};
  }};
}
test('production probe checks public shell, release, resources and guest admin rejection',async()=>{
  const {checkProduction}=await import('../scripts/check-production.mjs');const data=fixture();
  assert.deepEqual(await checkProduction({fetcher:data.fetcher,expectedCommit:commit}),{commit,qualityRunId:17,checks:6});
  assert.equal(data.calls.length,6);
  assert.ok(data.calls.every(c=>!c.options.headers.Authorization&&c.options.redirect==='manual'));
  assert.equal(data.calls.find(c=>c.url.endsWith('/api/admin')).options.body,'{}');
});
test('probe rejects unverified/wrong releases, lost CSP and failed HTTP without exposing responses',async()=>{
  const {checkProduction}=await import('../scripts/check-production.mjs');
  for(const patch of [{release:{verified:false}},{release:{commit:'b'.repeat(40)}},{release:{qualityRunId:null}},
    {policy:"script-src 'self' 'unsafe-inline'"},{policy:"script-src 'self' 'unsafe-eval'"},{policy:''},
    {status:503},{shell:'Maintenance'},{reject:true}]){
    await assert.rejects(checkProduction({fetcher:fixture(patch).fetcher,expectedCommit:commit}),error=>
      error.message.startsWith('production_')&&!error.message.includes('secret'));
  }
  await assert.rejects(checkProduction({fetcher:()=>assert.fail('no request'),expectedCommit:'invalid'}),/expected_commit_invalid/);
});
