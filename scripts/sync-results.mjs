// Runs only in the protected main workflow. Tokens and response bodies are never logged.
const endpoint='https://footbazed47.vercel.app/api/sync-results';
async function run(){
  if(process.env.GITHUB_REPOSITORY!=='bonineswerh/footbazed47'||process.env.GITHUB_REF!=='refs/heads/main')throw new Error('unexpected_workflow');
  const tokenUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if(tokenUrl.protocol!=='https:'||!(tokenUrl.hostname.endsWith('.actions.githubusercontent.com')))throw new Error('unexpected_identity_origin');
  tokenUrl.searchParams.set('audience',endpoint);
  let failed=false;
  for(const league of ['PL','PD','BL1','SA','FL1','CL']){
    const identity=await fetch(tokenUrl,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!identity.ok)throw new Error('identity_unavailable');
    const {value}=await identity.json();
    if(typeof value!=='string'||value.length>16000)throw new Error('invalid_identity');
    const response=await fetch(`${endpoint}?league=${league}`,{method:'POST',headers:{Authorization:`Bearer ${value}`},redirect:'error',signal:AbortSignal.timeout(65000)});
    if(!response.ok){console.error(`${league}: sync failed (${response.status})`);failed=true;if(response.status===429||response.status===403)break;}
    else{const result=await response.json();if(!['updated','skipped'].includes(result.status))throw new Error('invalid_sync_response');console.log(`${league}: ${result.status}`);}
    // Leave room for manual admin requests under the source's 10 calls/minute limit.
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  if(failed)process.exitCode=1;
}
run().catch(()=>{console.error('Automatic match synchronization failed');process.exitCode=1;});
