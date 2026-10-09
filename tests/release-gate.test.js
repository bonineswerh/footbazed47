'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const sha='a'.repeat(40),repository='bonineswerh/footbazed47';
const environment={VERCEL:'1',VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:sha,
  VERCEL_GIT_REPO_OWNER:'bonineswerh',VERCEL_GIT_REPO_SLUG:'footbazed47',VERCEL_GIT_COMMIT_REF:'main'};
const run=(overrides={})=>({id:17,head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',
  name:'Quality Gate',repository:{full_name:repository},head_repository:{full_name:repository},
  status:'completed',conclusion:'success',...overrides});
const jobs=()=>({jobs:['Static, unit and E2E','Clean database and SQL tests','Secret scan']
  .map(name=>({name,run_id:17,head_sha:sha,status:'completed',conclusion:'success'}))});

test('production requires exact Git identity; local, CI and preview never wait',async()=>{
  const {releaseIdentity,enforceProductionRelease}=await import('../scripts/check-release.mjs');
  assert.deepEqual(releaseIdentity(environment),{sha,repository});
  for(const patch of [{VERCEL_GIT_COMMIT_SHA:''},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(7)},
    {VERCEL_GIT_COMMIT_REF:'feature/test'},{VERCEL_GIT_REPO_OWNER:'other'}]){
    assert.throws(()=>releaseIdentity({...environment,...patch}),/release_identity/);
  }
  for(const env of [{},{CI:'true'},{...environment,VERCEL_ENV:'preview'}]){
    const result=await enforceProductionRelease({environment:env,fetcher:()=>assert.fail('network must not run')});
    assert.equal(result.verified,false);
  }
});

test('another commit, fork or workflow cannot authorize the release',async()=>{
  const {selectQualityRun}=await import('../scripts/check-release.mjs');
  for(const patch of [{head_sha:'b'.repeat(40)},{event:'pull_request'},{head_branch:'feature/test'},
    {path:'.github/workflows/other.yml'},{name:'Other'},
    {repository:{full_name:'other/repo'}},{head_repository:{full_name:'other/repo'}}]){
    assert.equal(selectQualityRun({workflow_runs:[run(patch)]},sha),null);
  }
  assert.throws(()=>selectQualityRun({},sha),/response_invalid/);
  assert.throws(()=>selectQualityRun({workflow_runs:[run({id:0})]},sha),/identity_invalid/);
  for(const conclusion of ['failure','cancelled','skipped','neutral','timed_out',null]){
    assert.throws(()=>selectQualityRun({workflow_runs:[run({conclusion})]},sha),/quality_gate_failed/);
  }
  assert.throws(()=>selectQualityRun({workflow_runs:[run({status:'unknown'})]},sha),/state_invalid/);
  assert.equal(selectQualityRun({workflow_runs:[run({id:15}),run()]},sha).id,17);
});

test('all three required jobs must succeed for the same run and commit',async()=>{
  const {verifyQualityJobs}=await import('../scripts/check-release.mjs');
  assert.doesNotThrow(()=>verifyQualityJobs(jobs(),17,sha));
  for(const patch of [{run_id:18},{head_sha:'b'.repeat(40)},{status:'in_progress'},{conclusion:'skipped'},{conclusion:'failure'}]){
    const payload=jobs();Object.assign(payload.jobs[0],patch);
    assert.throws(()=>verifyQualityJobs(payload,17,sha),/not_successful/);
  }
  assert.throws(()=>verifyQualityJobs({jobs:jobs().jobs.slice(1)},17,sha),/not_successful/);
  assert.throws(()=>verifyQualityJobs({jobs:[...jobs().jobs,jobs().jobs[0]]},17,sha),/not_successful/);
});

test('pending becomes successful without publishing early',async()=>{
  const {enforceProductionRelease}=await import('../scripts/check-release.mjs');
  let clock=0,calls=0;
  const result=await enforceProductionRelease({environment,now:()=>clock,timeoutMs:100,pollMs:10,
    wait:async ms=>{clock+=ms;},log:()=>{},fetcher:async url=>{
      calls++;assert.match(url,/^https:\/\/api\.github\.com\/repos\/bonineswerh\/footbazed47\//);
      return {ok:true,json:async()=>url.includes('/jobs?')?jobs():
        {workflow_runs:calls===1?[]:[run()]}};
    }});
  assert.deepEqual(result,{verified:true,commit:sha,qualityRunId:17});
  assert.equal(clock,10);assert.equal(calls,3);
});

test('failure, invalid payload and network unavailability fail closed with bounded waiting',async()=>{
  const {enforceProductionRelease}=await import('../scripts/check-release.mjs');
  const options={environment,log:()=>{}};
  await assert.rejects(enforceProductionRelease({...options,fetcher:async()=>({ok:true,
    json:async()=>({workflow_runs:[run({conclusion:'failure'})]})})}),/quality_gate_failed/);
  await assert.rejects(enforceProductionRelease({...options,fetcher:async()=>({ok:true,json:async()=>({})})}),/response_invalid/);
  await assert.rejects(enforceProductionRelease({...options,fetcher:async()=>({ok:false,status:404})}),/request_rejected/);
  for(const fetcher of [async()=>{throw new Error('private upstream diagnostics');},async()=>({ok:false,status:403})]){
    let clock=0,calls=0;
    await assert.rejects(enforceProductionRelease({...options,now:()=>clock,timeoutMs:25,pollMs:10,
      wait:async ms=>{clock+=ms;},fetcher:async(...args)=>{calls++;return fetcher(...args);}}),/wait_timed_out/);
    assert.equal(clock,25);assert.equal(calls,3);
  }
});

test('private repository token is confined to fixed GitHub reads and never logs or release metadata',async()=>{
  const {enforceProductionRelease}=await import('../scripts/check-release.mjs');
  const token='test-only-read-credential',logs=[],requests=[];
  const result=await enforceProductionRelease({environment:{...environment,FOOTBAZED_GITHUB_READ_TOKEN:token},
    log:text=>logs.push(text),fetcher:async(url,options)=>{
      requests.push(url);assert.match(url,/^https:\/\/api\.github\.com\/repos\/bonineswerh\/footbazed47\/actions\//);
      assert.equal(options.headers.Authorization,`Bearer ${token}`);assert.equal(options.redirect,'error');
      return{ok:true,json:async()=>url.includes('/jobs?')?jobs():{workflow_runs:[run()]}};
    }});
  assert.equal(requests.length,2);assert.deepEqual(result,{verified:true,commit:sha,qualityRunId:17});
  assert.equal(JSON.stringify({logs,result}).includes(token),false);
  await assert.rejects(enforceProductionRelease({environment:{...environment,FOOTBAZED_GITHUB_READ_TOKEN:token},log:()=>{},fetcher:async()=>({ok:false,status:401})}),/quality_request_rejected/);
});

test('malformed read credentials fail before network access, preview still needs no credential',async()=>{
  const {enforceProductionRelease}=await import('../scripts/check-release.mjs');
  for(const token of ['not a token','test\nsecret','x'.repeat(4097)])await assert.rejects(enforceProductionRelease({
    environment:{...environment,FOOTBAZED_GITHUB_READ_TOKEN:token},fetcher:()=>assert.fail('no network')}),/quality_read_token_invalid/);
  assert.equal((await enforceProductionRelease({environment:{...environment,VERCEL_ENV:'preview',FOOTBAZED_GITHUB_READ_TOKEN:'invalid token'},fetcher:()=>assert.fail('no network')})).verified,false);
});
