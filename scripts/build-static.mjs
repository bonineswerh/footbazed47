import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {localeSources,englishResource} from './localization.mjs';
import {enforceProductionRelease} from './check-release.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=path.join(root,'dist');
const publicFiles=[
  'index.html',
  'admin.html',
  'app.js',
  'styles.css',
  'admin.css',
  'robots.txt'
];
const publicDirectories=['assets','css','js'];

// Fail before replacing the bundle. Preview/local builds do not wait for CI;
// production uses only the exact Vercel Git identity and successful required jobs.
const release=await enforceProductionRelease();
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});

for(const relativePath of [...publicFiles,...publicDirectories]){
  const source=path.join(root,relativePath);
  if(!existsSync(source))throw new Error(`Missing public build input: ${relativePath}`);
  cpSync(source,path.join(output,relativePath),{recursive:true});
}
writeFileSync(path.join(output,'release.json'),JSON.stringify(release)+'\n');
// Language variants contain only their own authored UI text. No runtime
// translation observer, extra dictionary fetch or evaluation is involved.
const english=JSON.parse(readFileSync(path.join(root,'locales/en.json'),'utf8'));
for(const file of localeSources){
  const target=path.join(output,file.endsWith('.html')?'en':'en-assets',file);
  mkdirSync(path.dirname(target),{recursive:true});
  writeFileSync(target,englishResource(readFileSync(path.join(root,file),'utf8'),file,english));
}

const forbidden=new Set(['supabase','tests','scripts','docs','types','node_modules','.env','.git']);
const leaked=readdirSync(output).filter(name=>forbidden.has(name));
if(leaked.length)throw new Error(`Internal paths leaked into static output: ${leaked.join(', ')}`);
// Vercel's filesystem route wins over rewrites. A static sitemap would hide
// the dynamic catalogue served by /api/sitemap at /sitemap.xml.
if(existsSync(path.join(output,'sitemap.xml')))throw new Error('Static sitemap shadows the dynamic sitemap rewrite');

const outputHtml=['index.html','en/index.html'].map(file=>readFileSync(path.join(output,file),'utf8')).join('\n');
const resources=[...outputHtml.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
for(const resource of resources){
  if(/^(?:https?:|data:|#|mailto:|\/api\/)/u.test(resource))continue;
  const localPath=resource.split('?')[0].replace(/^\//u,'');
  if(localPath&&!existsSync(path.join(output,localPath))){
    throw new Error(`Static bundle is missing referenced resource: ${localPath}`);
  }
}

console.log(`Static production bundle created in dist (${publicFiles.length} files, ${publicDirectories.length} directories, ${resources.length} references verified).`);
