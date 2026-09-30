import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const errors=[];
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
for(const file of ['index.html','admin.html',...frontendFiles]){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  if(file.endsWith('.js'))try{new Script(source,{filename:file});}catch(error){errors.push(`Invalid JavaScript: ${error.message}`);}
  if(/\bon(?:click|input|change|submit|keydown|keyup|keypress|error|load|focus|blur|mouseover|pointerdown)\s*=\s*["']/iu.test(source))errors.push(`Inline event handler is forbidden: ${file}`);
  if(/\beval\s*\(|\bnew\s+Function\s*\(/u.test(source))errors.push(`Executable strings are forbidden: ${file}`);
  if(file.endsWith('.html')&&/<script\b(?![^>]*\bsrc=)[^>]*>/iu.test(source))errors.push(`Inline scripts are forbidden: ${file}`);
}
if(html.indexOf('src="js/actions.js')>html.indexOf('src="js/home.js'))errors.push('Action dispatcher must load before its consumers');
const feedFrontend=fs.readFileSync(path.join(root,'js','feed.js'),'utf8');
if(/FBZMessages|ensureMessagesModule|forwardRating|directChatOv|page-chat|getUserMedia|MediaRecorder|rpc\(['"](?:get_direct_messages|send_direct_message|send_match_chat_message)/u.test(frontend+'\n'+html))errors.push('Messaging is retired; client surfaces must not return');
for(const retired of ['js/messages.js','css/messages.css'])if(fs.existsSync(path.join(root,retired)))errors.push(`Retired asset must not be published: ${retired}`);
if(/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i.test(frontend))errors.push('Service-role material must not appear in frontend files');
if(/API_FOOTBALL_KEY|x-apisports-key|v3\.football\.api-sports\.io/i.test(frontend))errors.push('API-Football credentials and requests must stay server-side');
for(const match of frontend.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){
  try{
    const payload=JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString('utf8'));
    if(payload.role==='service_role')errors.push('A service-role JWT must not appear in frontend files');
  }catch{}
}
if(/uukacnyvjvgmmhbkmfzf|https:\/\/[^'"\s]+\.supabase\.co/i.test(frontend))errors.push('A Supabase project must not be hardcoded in frontend files');
if(!html.includes('src="/api/config.js"'))errors.push('Runtime Supabase configuration must load from /api/config.js');
if(html.indexOf('src="/api/config.js"')>html.indexOf('src="js/core.js'))errors.push('Runtime configuration must load before js/core.js');
if(/<script[^>]+src=["']https?:\/\//i.test(html))errors.push('Frontend scripts must not load from a runtime CDN');
if(/fonts\.(?:googleapis|gstatic)\.com/i.test(html))errors.push('Fonts must be self-hosted');
for(const feature of [
  {name:'admin',script:'js/admin.js',style:'admin.css'},
  {name:'entities',script:'js/entities.js',style:'css/entities.css'},
  {name:'feed',script:'js/feed.js',style:'css/feed.css'},
  {name:'ratings',script:'js/ratings.js',style:'css/ratings.css'},
  {name:'search',script:'js/search.js'}
]){
  if(html.includes(`src="${feature.script}?`)||(feature.style&&html.includes(`href="${feature.style}?`)))errors.push(`${feature.name} assets must not load eagerly`);
  if(!frontend.includes(`script:'${feature.script}?`)||(feature.style&&!frontend.includes(`style:'${feature.style}?`)))errors.push(`${feature.name} assets must use the feature loader`);
}
if(!html.includes('<base href="/">'))errors.push('Pretty routes require an absolute document base');
if(!feedFrontend.includes("rpc('get_social_feed_page'"))errors.push('Social feed must use cursor pagination');
if(/get_social_feed['"],\{[^}]*p_offset/su.test(feedFrontend))errors.push('Social feed must not use offset pagination');
if(/go\('feed'\);\s*setTimeout\([^\n]*focusRating/su.test(frontend))errors.push('Notification routing must not depend on a render timer');

const supabaseVersion=packageJson.dependencies?.['@supabase/supabase-js'];
if(!/^\d+\.\d+\.\d+$/.test(supabaseVersion||''))errors.push('@supabase/supabase-js must use an exact version');
else{
  const vendorRelative=`assets/vendor/supabase-${supabaseVersion}.js`;
  const vendorPath=path.join(root,vendorRelative);
  if(!html.includes(`src="${vendorRelative}"`))errors.push(`index.html must load the pinned Supabase bundle: ${vendorRelative}`);
  if(!fs.existsSync(vendorPath))errors.push(`Missing pinned Supabase bundle: ${vendorRelative}`);
  const sourcePath=path.join(root,'node_modules','@supabase','supabase-js','dist','umd','supabase.js');
  if(fs.existsSync(vendorPath)&&fs.existsSync(sourcePath)){
    if(hash(vendorPath)!==hash(sourcePath))errors.push('Pinned Supabase bundle differs from the installed package');
  }
}
if(!/^\d+\.\d+\.\d+$/.test(packageJson.devDependencies?.['axe-core']||''))errors.push('axe-core must use an exact version');

const pinnedFontFiles=[
  ['@fontsource-variable/onest','files/onest-cyrillic-ext-wght-normal.woff2','assets/fonts/onest-cyrillic-ext-wght-normal.woff2'],
  ['@fontsource-variable/onest','files/onest-cyrillic-wght-normal.woff2','assets/fonts/onest-cyrillic-wght-normal.woff2'],
  ['@fontsource-variable/onest','files/onest-latin-ext-wght-normal.woff2','assets/fonts/onest-latin-ext-wght-normal.woff2'],
  ['@fontsource-variable/onest','files/onest-latin-wght-normal.woff2','assets/fonts/onest-latin-wght-normal.woff2'],
  ['@fontsource/bebas-neue','files/bebas-neue-latin-ext-400-normal.woff2','assets/fonts/bebas-neue-latin-ext-400-normal.woff2'],
  ['@fontsource/bebas-neue','files/bebas-neue-latin-400-normal.woff2','assets/fonts/bebas-neue-latin-400-normal.woff2']
];
for(const [dependency,sourceRelative,vendorRelative] of pinnedFontFiles){
  if(!/^\d+\.\d+\.\d+$/.test(packageJson.dependencies?.[dependency]||''))errors.push(`${dependency} must use an exact version`);
  const sourcePath=path.join(root,'node_modules',...dependency.split('/'),...sourceRelative.split('/'));
  const vendorPath=path.join(root,...vendorRelative.split('/'));
  if(!fs.existsSync(vendorPath))errors.push(`Missing self-hosted font: ${vendorRelative}`);
  else if(fs.existsSync(sourcePath)&&hash(vendorPath)!==hash(sourcePath))errors.push(`Self-hosted font differs from ${dependency}: ${vendorRelative}`);
}

const forbiddenWrites=[
  /from\(['"]ratings['"]\)\.(?:insert|upsert|update|delete)/,
  /from\(['"]player_ratings['"]\)\.(?:insert|upsert|update|delete)/
];
for(const pattern of forbiddenWrites){
  if(pattern.test(frontend))errors.push(`Direct rating write found: ${pattern}`);
}

const requiredScripts=['js/session-hint.js','js/domain.js','js/media.js','js/data.js','js/seo.js','js/performance.js','js/actions.js','js/shell-actions.js','app.js','js/auth.js','js/rating-loader.js','js/matches.js'];
for(const script of requiredScripts){
  if(!html.includes(`src="${script}?`))errors.push(`Required script is not versioned in index.html: ${script}`);
}
if(!/script(?:\.src\s*=|:)\s*['"]js\/ratings\.js\?v=\d+/u.test(frontend))errors.push('Rating loader must reference a versioned ratings module');

const vercelIgnorePath=path.join(root,'.vercelignore');
if(!fs.existsSync(vercelIgnorePath)){
  errors.push('Missing .vercelignore: internal files could be served publicly');
}else{
  const ignoredPaths=fs.readFileSync(vercelIgnorePath,'utf8')
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(line=>line&&!line.startsWith('#'));
  for(const requiredPath of ['supabase/','tests/','docs/','README.md','AGENTS.md','.env.example']){
    if(!ignoredPaths.includes(requiredPath))errors.push(`.vercelignore must exclude ${requiredPath}`);
  }
  for(const buildPath of ['scripts/','types/','tsconfig.json']){
    if(ignoredPaths.includes(buildPath))errors.push(`.vercelignore must retain build input ${buildPath}`);
  }
}

const vercelConfig=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
if(vercelConfig.outputDirectory!=='dist')errors.push('Vercel must publish only the isolated dist directory');
const securityHeaders=(vercelConfig.headers||[]).flatMap(item=>item.headers||[]);
const csp=securityHeaders.find(item=>item.key==='Content-Security-Policy')?.value||'';
if(!/(?:^|;)\s*script-src 'self'\s*(?:;|$)/u.test(csp)||!/(?:^|;)\s*script-src-attr 'none'\s*(?:;|$)/u.test(csp))errors.push('CSP must reject inline scripts, event handlers and eval');
const permissions=securityHeaders.find(item=>item.key==='Permissions-Policy')?.value||'';
if(!csp.includes("media-src 'none'"))errors.push('Retired chat media must not be allowed by CSP');
if(!permissions.includes('microphone=()'))errors.push('Microphone access must be disabled');
const rewriteSources=new Set((vercelConfig.rewrites||[]).map(item=>item.source));
for(const route of ['/club/:id','/player/:id','/competition/:id','/profile/:id','/match/:id']){
  if(!rewriteSources.has(route))errors.push(`Missing SPA rewrite for ${route}`);
}
if(!rewriteSources.has('/sitemap.xml'))errors.push('Missing dynamic sitemap rewrite');
if(!fs.existsSync(path.join(root,'robots.txt')))errors.push('Missing robots.txt');

if(errors.length){
  errors.forEach(error=>console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Static checks passed: ${ids.length} ids, ${resources.length} resources, ${frontendFiles.length} frontend scripts.`);
