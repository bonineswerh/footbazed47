import {createReadStream,existsSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT)||4173;
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const productionSupabaseUrl='https://uukacnyvjvgmmhbkmfzf.supabase.co';

function runtimeConfig(){
  const supabaseUrl=String(process.env.SUPABASE_PUBLIC_URL||process.env.SUPABASE_URL||'').trim();
  const supabaseKey=String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'').trim();
  if(!supabaseUrl||!supabaseKey){
    return {environment:'development',error:'runtime_config_missing'};
  }
  if(supabaseUrl===productionSupabaseUrl&&process.env.FOOTBAZED_ALLOW_PRODUCTION!=='1'){
    return {environment:'development',error:'production_supabase_blocked'};
  }
  return {environment:'development',supabaseUrl,supabaseKey};
}

const server=createServer((request,response)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}
  catch{response.writeHead(400).end('Bad request');return;}
  if(pathname==='/api/config.js'){
    const body=`window.__FOOTBAZED_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify(runtimeConfig())});`;
    response.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?'':body);
    return;
  }
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  let file=resolve(root,relative);
  if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403).end('Forbidden');return;}
  if((!existsSync(file)||!statSync(file).isFile())&&/^\/(?:club|player|profile)\/[^/]+\/?$|^\/match\/[^/]+(?:\/chat)?\/?$|^\/(?:matches|feed|leaderboard|friends|admin)\/?$/u.test(pathname))file=resolve(root,'index.html');
  if(!existsSync(file)||!statSync(file).isFile()){response.writeHead(404).end('Not found');return;}
  response.writeHead(200,{
    'Content-Type':types[extname(file).toLocaleLowerCase('en-US')]||'application/octet-stream',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  createReadStream(file).pipe(response);
});

server.listen(port,'127.0.0.1',()=>console.log(`FOOTBAZED test server: http://127.0.0.1:${port}`));

function shutdown(){
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),2_000).unref();
}

process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
