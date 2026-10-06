'use strict';

// Public document metadata uses the same rules as SPA navigation. Never forward
// a viewer's cookie/token and never use service_role for a cacheable document.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const seo=require('../js/seo.js');
const {resolveRuntimeConfig}=require('./config.js');
const templates=new Map();
const entities={club:['clubs','id,name,short_name,area_name,venue,founded'],player:['players','id,name,team,position'],competition:['competitions','id,name'],match:['matches','id,home_team_name,away_team_name,league_name,match_date']};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function routeFromPath(value){
  const path=String(value||'/').replace(/\/$/,'')||'/';
  if(/^\/en(?:\/|$)/u.test(path))return {...routeFromPath(path.slice(3)||'/'),language:'en',path};
  const match=path.match(/^\/(club|player|competition|league|match)\/([1-9]\d{0,14})(\/chat)?$/);
  if(match&&(!match[3]||match[1]==='match'))return {kind:match[1]==='league'?'competition':match[1],id:Number(match[2]),chat:Boolean(match[3]),path};
  const staticKind={'/':'home','/matches':'matches','/discover':'leaderboard','/leaderboard':'leaderboard','/feed':'feed','/friends':'friends','/admin':'admin'}[path];
  if(staticKind)return {kind:staticKind,path};
  if(/^\/profile\/[\da-f-]{36}$/i.test(path))return {kind:'profile',path};
  return {kind:'missing',path};
}

function renderDocument(html,metadata){
  const en=/^\/en(?:\/|$)/u.test(metadata.path);
  let result=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escape(metadata.title)+'</title>');
  const meta=(name,value)=>{result=result.replace(new RegExp('(<meta (?:name|property)="'+name+'" content=")[^"]*(")'),(_,prefix,suffix)=>prefix+escape(value)+suffix);};
  meta('description',metadata.description);
  meta('robots',metadata.index?'index,follow':'noindex,nofollow');
  for(const [name,value] of Object.entries({title:metadata.title,description:metadata.description,url:metadata.canonical,image:metadata.image,type:metadata.type}))meta('og:'+name,value);
  result=result.replace(/(<link rel="canonical" href=")[^"]*(")/,(_,prefix,suffix)=>prefix+escape(metadata.canonical)+suffix);
  const basePath=metadata.path.replace(/^\/en(?=\/|$)/u,'')||'/';
  const origin='https://footbazed47.vercel.app';
  const links=[['ru',origin+basePath],['en',origin+'/en'+(basePath==='/'?'':basePath)],['x-default',origin+basePath]];
  result=result.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">\s*/gu,'');
  result=result.replace('</head>',links.map(([lang,url])=>`<link rel="alternate" hreflang="${lang}" href="${escape(url)}">`).join('\n')+'\n</head>');
  if(metadata.structuredData){
    const json=JSON.stringify({'@context':'https://schema.org',...metadata.structuredData}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    result=result.replace('</head>',`<script type="application/ld+json" id="fbzStructuredData">${json}</script>\n</head>`);
  }
  const fallback=`<noscript><main class="no-script"><h1>${escape(metadata.title)}</h1><p>${escape(metadata.description)}</p><p>${en?'Enable JavaScript to rate matches, search and use your football diary.':'Для оценок, поиска и футбольного дневника включите JavaScript.'}</p><a href="${en?'/en':''}/matches">${en?'Match calendar':'Календарь матчей'}</a></main></noscript>`;
  return result.replace('<body>','<body>\n'+fallback);
}

async function resolvePage(route,config,request=fetch){
  const seo=require('../js/seo.js').forLanguage(route.language||'ru');
  const en=route.language==='en';
  if(route.kind==='missing')return {status:404,metadata:seo.apply({title:en?'Page not found — FOOTBAZED':'Страница не найдена — FOOTBAZED',path:route.path,index:false})};
  if(route.chat)return {status:410,metadata:seo.apply({title:en?'Chats are closed — FOOTBAZED':'Чаты закрыты — FOOTBAZED',description:en?'Discuss football in review comments. Open the match to see fan ratings.':'Обсуждайте футбол в комментариях к рецензиям. Перейдите к матчу, чтобы посмотреть оценки болельщиков.',path:route.path,index:false})};
  if(route.kind==='profile')return {status:200,metadata:seo.apply({title:en?'Profile — FOOTBAZED':'Профиль — FOOTBAZED',path:route.path,index:false})};
  if(!route.id)return {status:200,metadata:seo.setStatic(route.kind)};
  if(config.error)throw new Error('public_config_unavailable');
  const [table,select]=entities[route.kind];
  const url=new URL(`/rest/v1/${table}`,config.supabaseUrl);
  url.search=new URLSearchParams({id:`eq.${route.id}`,select,limit:'1'}).toString();
  const response=await request(url,{headers:{apikey:config.supabaseKey},signal:AbortSignal.timeout(3500)});
  if(!response.ok)throw new Error('public_data_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error('public_data_invalid');
  if(!rows.length)return {status:404,metadata:seo.apply({title:en?'Page not found — FOOTBAZED':'Страница не найдена — FOOTBAZED',path:route.path,index:false})};
  return {status:200,metadata:seo[route.kind](rows[0])};
}

module.exports=async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.status(405).end();return;}
  const route=routeFromPath(req.query?.path||new URL(req.url,'https://footbazed47.vercel.app').pathname);
  let result;
  try{result=await resolvePage(route,resolveRuntimeConfig());}
  catch{result={status:503,metadata:seo.forLanguage(route.language||'ru').apply({title:route.language==='en'?'FOOTBAZED — temporarily unavailable':'FOOTBAZED — временно недоступно',path:route.path,index:false})};res.setHeader('Retry-After','30');}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  // Private/profile shell never carries person-specific metadata or shared cache.
  res.setHeader('Cache-Control',result.status===200&&result.metadata.index?'public, s-maxage=300, stale-while-revalidate=600':'no-store');
  try{
    const language=route.language||'ru';
    if(!templates.has(language))templates.set(language,readFileSync(join(process.cwd(),'dist',language==='en'?'en':'','index.html'),'utf8'));
    res.status(result.status).end(req.method==='HEAD'?'':renderDocument(templates.get(language),result.metadata));
  }catch{res.setHeader('Cache-Control','no-store');res.status(503).end(route.language==='en'?'FOOTBAZED is temporarily unavailable':'FOOTBAZED временно недоступен');}
};
module.exports.routeFromPath=routeFromPath;
module.exports.resolvePage=resolvePage;
module.exports.renderDocument=renderDocument;
