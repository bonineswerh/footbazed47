// Explicit production diagnosis, never part of CI. Only public configuration is used.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolveRuntimeConfig}=require('../api/config');
const config=resolveRuntimeConfig({VERCEL:'1',VERCEL_ENV:'production'});
try{
  const response=await fetch(config.supabaseUrl+'/rest/v1/http_request_queue?select=id&limit=0',{
    headers:{apikey:config.supabaseKey,'Accept-Profile':'net'},redirect:'error',signal:AbortSignal.timeout(10000)
  });
  const body=await response.json();
  if(response.status!==406||body?.code!=='PGRST106')throw new Error('unsafe_schema');
  console.log('Scheduler queue is not exposed through the public Data API.');
}catch{console.error('scheduler_boundary_check_failed');process.exitCode=1;}
