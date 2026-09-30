import {createReadStream,existsSync,statSync,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import publicConfig from '../api/config.js';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT)||4173;
const securityHeaders=Object.fromEntries(JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8')).headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[key,value]));
// This server binds only to HTTP loopback, with no TLS listener. Keep all script
// restrictions; transport upgrades belong to the HTTPS production deployment.
delete securityHeaders['Strict-Transport-Security'];
securityHeaders['Content-Security-Policy']=securityHeaders['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests\b/u,'');
const demo=process.argv.includes('--demo');
if(demo&&(port!==4174||process.env.PORT!=='4174'||publicConfig.isCI(process.env)||process.env.VERCEL||process.env.VERCEL_ENV)){
  throw new Error('Demo requires PORT=4174 on a local machine outside CI and Vercel.');
}
const demoFixture=demo?await (await import('./demo-fixture.mjs')).createDemoFixture():'';
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
function runtimeConfig(){
  return demo?{environment:'demo',error:'runtime_config_missing'}:publicConfig.resolveRuntimeConfig(process.env,{local:true});
}

const server=createServer((request,response)=>{
  // Exercise production script restrictions in local development and browser tests.
  for(const [key,value] of Object.entries(securityHeaders))response.setHeader(key,value);
  let pathname;
  let url;
  try{url=new URL(request.url,'http://localhost');pathname=decodeURIComponent(url.pathname);}
  catch{response.writeHead(400).end('Bad request');return;}
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  if(pathname==='/__demo/fixture.js'){
    if(!demo){response.writeHead(404).end('Not found');return;}
    response.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?'':demoFixture);
    return;
  }
  if(pathname==='/api/config.js'){
    const body=`window.__FOOTBAZED_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify(runtimeConfig())});`;
    response.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?'':body);
    return;
  }
  if(/^\/match\/[1-9]\d*\/chat\/?$/.test(pathname)){response.writeHead(410,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end('<h1>Чаты закрыты</h1><a href="/matches">К матчам и рецензиям</a>');return;}
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  let file=resolve(root,relative);
  if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403).end('Forbidden');return;}
  if((!existsSync(file)||!statSync(file).isFile())&&/^\/(?:club|player|profile|competition|league)\/[^/]+\/?$|^\/match\/[^/]+\/?$|^\/(?:matches|feed|leaderboard|discover|friends|admin)\/?$/u.test(pathname))file=resolve(root,'index.html');
  if(!existsSync(file)||!statSync(file).isFile()){response.writeHead(404).end('Not found');return;}
  response.writeHead(200,{
    'Content-Type':types[extname(file).toLocaleLowerCase('en-US')]||'application/octet-stream',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  if(request.method==='HEAD'){response.end();return;}
  if(demo&&file===resolve(root,'index.html')&&url.searchParams.get('__e2e')==='1'){
    response.end(readFileSync(file,'utf8').replace('<script src="/api/config.js"','<script src="/__demo/fixture.js"></script>\n  <script src="/api/config.js"'));
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port,'127.0.0.1',()=>console.log(`FOOTBAZED test server: http://127.0.0.1:${port}`));

function shutdown(){
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),2_000).unref();
}

process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
