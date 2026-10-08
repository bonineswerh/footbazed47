import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const origin='https://footbazed47.vercel.app';
// Read only public resources, never sessions, reviews, provider data or keys.
export async function checkProduction({fetcher=fetch,expectedCommit=null}={}){
  if(expectedCommit!==null&&!/^[a-f0-9]{40}$/.test(expectedCommit))throw new Error('expected_commit_invalid');
  async function request(path,{method='GET',status=200,type}={}){
    let response;
    try{
      response=await fetcher(origin+path,{method,redirect:'manual',
        signal:AbortSignal.timeout(15_000),headers:{'Cache-Control':'no-cache'},
        ...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
    }catch{throw new Error('production_request_unavailable');}
    if(response.status!==status)throw new Error('production_http_status_unexpected');
    if(type&&!String(response.headers.get('content-type')||'').includes(type))throw new Error('production_content_type_invalid');
    return response;
  }
  const [home,english,releaseResponse]=await Promise.all([
    request('/',{type:'text/html'}),request('/en/',{type:'text/html'}),
    request('/release.json',{type:'application/json'})
  ]);
  const policy=String(home.headers.get('content-security-policy')||'');
  const scripts=policy.split(';').find(value=>value.trim().startsWith('script-src '));
  if(!scripts?.includes("'self'")||scripts.includes("'unsafe-inline'")||scripts.includes("'unsafe-eval'")){
    throw new Error('production_script_policy_invalid');
  }
  const [html,enHtml,release]=await Promise.all([home.text(),english.text(),releaseResponse.json().catch(()=>null)]);
  if(!html.includes('id="mainNav"')||!enHtml.includes('id="mainNav"'))throw new Error('production_shell_missing');
  if(release?.verified!==true||!/^[a-f0-9]{40}$/.test(String(release.commit||''))
    ||!Number.isSafeInteger(release.qualityRunId)||release.qualityRunId<1)throw new Error('production_release_unverified');
  if(expectedCommit&&release.commit!==expectedCommit)throw new Error('production_commit_mismatch');
  const app=html.match(/src="(app\.js\?v=[A-Za-z0-9_-]+)"/);
  const css=html.match(/href="(styles\.css\?v=[A-Za-z0-9_-]+)"/);
  if(!app||!css)throw new Error('production_shell_resources_missing');
  await Promise.all([
    request('/'+app[1],{type:'javascript'}),request('/'+css[1],{type:'text/css'}),
    request('/api/admin',{method:'POST',status:403,type:'application/json'})
  ]);
  return {commit:release.commit,qualityRunId:release.qualityRunId,checks:6};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await checkProduction({expectedCommit:process.argv[2]||null});
    console.log(JSON.stringify({status:'ok',...result}));
  }catch(error){
    const allowed=new Set(['expected_commit_invalid','production_request_unavailable',
      'production_http_status_unexpected','production_content_type_invalid','production_script_policy_invalid',
      'production_shell_missing','production_release_unverified','production_commit_mismatch','production_shell_resources_missing']);
    console.error(allowed.has(error?.message)?error.message:'production_probe_failed');
    process.exitCode=1;
  }
}
