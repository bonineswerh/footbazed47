import {installSupabaseMock} from '../tests/e2e/mock-supabase.mjs';

export async function createDemoFixture(){
  const scripts=[];
  await installSupabaseMock({addInitScript:async(fn,arg)=>{
    scripts.push(`(${fn.toString()})(${JSON.stringify(arg)});`);
  }});
  return `if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('__e2e')==='1'){${scripts.join('\n')}}`;
}
