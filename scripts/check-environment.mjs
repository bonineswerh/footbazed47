import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const productionRef='uukacnyvjvgmmhbkmfzf';
const checkedVariables=[
  'SUPABASE_PUBLIC_URL',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL'
];

export function validateEnvironment({environment=process.env,files=[]}={}){
  const violations=[];
  const allowLocalOverride=environment.CI!=='true'&&environment.FOOTBAZED_ALLOW_PRODUCTION==='1';

  for(const name of checkedVariables){
    if(String(environment[name]||'').includes(productionRef)&&!allowLocalOverride){
      violations.push(`${name} points to the production Supabase project`);
    }
  }

  for(const file of files){
    if(file.contents.includes(productionRef))violations.push(`${file.name} contains the production Supabase project ref`);
  }

  if(environment.CI==='true'&&environment.FOOTBAZED_ALLOW_PRODUCTION==='1'){
    violations.push('FOOTBAZED_ALLOW_PRODUCTION cannot be enabled in CI');
  }
  return violations;
}

function localEnvironmentFiles(){
  return readdirSync(root)
    .filter(name=>name==='.env'||(name.startsWith('.env.')&&name!=='.env.example'))
    .map(name=>({name,contents:readFileSync(resolve(root,name),'utf8')}));
}

const invokedPath=process.argv[1]?resolve(process.argv[1]):'';
if(invokedPath===fileURLToPath(import.meta.url)){
  const violations=validateEnvironment({files:localEnvironmentFiles()});
  if(violations.length){
    violations.forEach(message=>console.error(`ERROR: ${message}`));
    process.exitCode=1;
  }else{
    console.log('Environment policy passed: production Supabase is blocked outside production deployment.');
  }
}
