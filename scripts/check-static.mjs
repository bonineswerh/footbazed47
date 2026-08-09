import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const errors=[];

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
if(duplicateIds.length)errors.push(`Duplicate HTML ids: ${duplicateIds.join(', ')}`);

const resources=[...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
for(const resource of resources){
  if(/^(?:https?:|data:|#|mailto:)/.test(resource))continue;
  const localPath=resource.split('?')[0].replace(/^\//,'');
  if(localPath&&!fs.existsSync(path.join(root,localPath)))errors.push(`Missing local resource: ${localPath}`);
}

const frontendFiles=['app.js',...fs.readdirSync(path.join(root,'js')).filter(file=>file.endsWith('.js')).map(file=>`js/${file}`)];
const frontend=frontendFiles.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
if(/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(frontend))errors.push('Service-role material must not appear in frontend files');

const forbiddenWrites=[
  /from\(['"]ratings['"]\)\.(?:insert|upsert|update|delete)/,
  /from\(['"]player_ratings['"]\)\.(?:insert|upsert|update|delete)/
];
for(const pattern of forbiddenWrites){
  if(pattern.test(frontend))errors.push(`Direct rating write found: ${pattern}`);
}

const requiredScripts=['js/domain.js','app.js','js/auth.js','js/ratings.js','js/matches.js','js/search.js'];
for(const script of requiredScripts){
  if(!html.includes(`src="${script}?`))errors.push(`Required script is not versioned in index.html: ${script}`);
}

if(errors.length){
  errors.forEach(error=>console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Static checks passed: ${ids.length} ids, ${resources.length} resources, ${frontendFiles.length} frontend scripts.`);
