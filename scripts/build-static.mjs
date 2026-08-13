import {cpSync,existsSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=path.join(root,'dist');
const publicFiles=[
  'index.html',
  'admin.html',
  'styles.css',
  'admin.css',
  'robots.txt',
  'sitemap.xml'
];
const publicDirectories=['assets','css','js'];

rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});

for(const relativePath of [...publicFiles,...publicDirectories]){
  const source=path.join(root,relativePath);
  if(!existsSync(source))throw new Error(`Missing public build input: ${relativePath}`);
  cpSync(source,path.join(output,relativePath),{recursive:true});
}

const forbidden=new Set(['supabase','tests','scripts','docs','types','node_modules','.env','.git']);
const leaked=readdirSync(output).filter(name=>forbidden.has(name));
if(leaked.length)throw new Error(`Internal paths leaked into static output: ${leaked.join(', ')}`);

console.log(`Static production bundle created in dist (${publicFiles.length} files, ${publicDirectories.length} directories).`);
