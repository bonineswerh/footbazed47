import {setTimeout as delay} from 'node:timers/promises';

const repository='bonineswerh/footbazed47';
const workflow='.github/workflows/ci.yml';
const requiredJobs=['Static, unit and E2E','Clean database and SQL tests','Secret scan'];
const pendingStates=new Set(['queued','in_progress','waiting','requested','pending']);

export function releaseIdentity(environment){
  if(environment.VERCEL!=='1'||environment.VERCEL_ENV!=='production')return null;
  const sha=String(environment.VERCEL_GIT_COMMIT_SHA||'');
  const repo=`${environment.VERCEL_GIT_REPO_OWNER||''}/${environment.VERCEL_GIT_REPO_SLUG||''}`;
  if(!/^[a-f0-9]{40}$/.test(sha)||repo!==repository||environment.VERCEL_GIT_COMMIT_REF!=='main'){
    throw new Error('release_identity_missing_or_invalid');
  }
  return {sha,repository};
}

export function selectQualityRun(payload,sha){
  if(!Array.isArray(payload?.workflow_runs))throw new Error('quality_response_invalid');
  const runs=payload.workflow_runs.filter(run=>run.head_sha===sha&&run.event==='push'
    &&run.head_branch==='main'&&run.path===workflow&&run.name==='Quality Gate'
    &&run.repository?.full_name===repository&&run.head_repository?.full_name===repository);
  runs.sort((a,b)=>Number(b.id)-Number(a.id));
  const run=runs[0];
  if(!run)return null;
  if(!Number.isSafeInteger(run.id)||run.id<1)throw new Error('quality_run_identity_invalid');
  if(run.status==='completed'){
    if(run.conclusion!=='success')throw new Error('quality_gate_failed');
  }else if(!pendingStates.has(run.status))throw new Error('quality_run_state_invalid');
  return run;
}

export function verifyQualityJobs(payload,runId,sha){
  if(!Array.isArray(payload?.jobs))throw new Error('quality_jobs_invalid');
  for(const name of requiredJobs){
    const jobs=payload.jobs.filter(job=>job.name===name);
    if(jobs.length!==1||jobs[0].run_id!==runId||jobs[0].head_sha!==sha
      ||jobs[0].status!=='completed'||jobs[0].conclusion!=='success'){
      throw new Error('required_quality_job_not_successful');
    }
  }
}

export async function enforceProductionRelease({environment=process.env,fetcher=fetch,
  wait=delay,now=Date.now,timeoutMs=25*60_000,pollMs=60_000,log=console.log}={}){
  const identity=releaseIdentity(environment);
  if(!identity)return {verified:false,commit:null,qualityRunId:null};
  const deadline=now()+timeoutMs;
  let observed='';
  async function read(path){
    const response=await fetcher(`https://api.github.com/repos/${repository}/${path}`,{
      headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},
      redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(12_000,deadline-now())))
    });
    if(!response.ok){
      if(response.status===429||response.status===403||response.status>=500)return null;
      throw new Error('quality_request_rejected');
    }
    try{return await response.json();}catch{throw new Error('quality_response_invalid');}
  }
  while(now()<deadline){
    let payload;
    try{
      payload=await read(`actions/workflows/ci.yml/runs?head_sha=${identity.sha}&event=push&branch=main&per_page=10`);
    }catch(error){
      if(error?.message==='quality_request_rejected'||error?.message==='quality_response_invalid')throw error;
      payload=null;
    }
    const run=payload?selectQualityRun(payload,identity.sha):null;
    if(run?.status==='completed'){
      let jobs;
      try{jobs=await read(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);}
      catch(error){
        if(error?.message==='quality_request_rejected'||error?.message==='quality_response_invalid')throw error;
      }
      if(jobs&&now()<deadline){
        verifyQualityJobs(jobs,run.id,identity.sha);
        log(`Release gate passed: ${identity.sha} / Quality Gate ${run.id}.`);
        return {verified:true,commit:identity.sha,qualityRunId:run.id};
      }
    }
    const state=run?`${run.id}:${run.status}`:'waiting';
    if(state!==observed){log('Release gate: waiting for this commit to pass all required GitHub jobs.');observed=state;}
    const remaining=deadline-now();
    if(remaining>0)await wait(Math.min(pollMs,remaining));
  }
  throw new Error('quality_gate_wait_timed_out');
}
