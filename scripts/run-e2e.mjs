import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=spawn(process.execPath,['scripts/serve.mjs'],{
  cwd:root,
  env:{...process.env,PORT:'4173'},
  stdio:'ignore',
  windowsHide:true
});
let stopped=false;

async function waitForServer(){
  for(let attempt=0;attempt<40;attempt++){
    if(server.exitCode!==null)throw new Error(`Test server exited with code ${server.exitCode}`);
    try{
      const response=await fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(500)});
      if(response.ok)return;
    }catch{}
    await new Promise(resolveDelay=>setTimeout(resolveDelay,200));
  }
  throw new Error('Test server did not become ready');
}

async function stopServer(){
  if(stopped||server.exitCode!==null)return;
  stopped=true;
  server.kill('SIGTERM');
  await Promise.race([once(server,'exit'),new Promise(resolveDelay=>setTimeout(resolveDelay,2_000))]);
  if(server.exitCode===null)server.kill('SIGKILL');
}

for(const signal of ['SIGINT','SIGTERM']){
  process.once(signal,async()=>{
    await stopServer();
    process.exit(130);
  });
}

try{
  await waitForServer();
  const runner=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{
    cwd:root,
    env:{...process.env,PW_EXTERNAL_SERVER:'1'},
    stdio:'inherit',
    windowsHide:true
  });
  const [code,signal]=await once(runner,'exit');
  process.exitCode=typeof code==='number'?code:(signal?1:0);
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
}finally{
  await stopServer();
}
