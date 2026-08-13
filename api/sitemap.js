'use strict';

const ORIGIN='https://footbazed47.vercel.app';
const PAGE_SIZE=1000;
const MAX_PAGES=10;

function escapeXml(value){
  return String(value??'').replace(/[<>&'"]/gu,character=>({
    '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'
  })[character]);
}

function validDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':date.toISOString().slice(0,10);
}

function entry(path,{lastmod='',changefreq='',priority=''}={}){
  return `<url><loc>${escapeXml(`${ORIGIN}${path}`)}</loc>${lastmod?`<lastmod>${escapeXml(lastmod)}</lastmod>`:''}${changefreq?`<changefreq>${changefreq}</changefreq>`:''}${priority?`<priority>${priority}</priority>`:''}</url>`;
}

function buildSitemap({clubs=[],players=[],competitions=[],matches=[]}={}){
  const urls=[
    entry('/',{changefreq:'daily',priority:'1.0'}),
    entry('/matches',{changefreq:'hourly',priority:'0.9'}),
    entry('/leaderboard',{changefreq:'daily',priority:'0.6'}),
    ...clubs.filter(item=>Number.isFinite(Number(item.id))).map(item=>entry(`/club/${Number(item.id)}`,{lastmod:validDate(item.updated_at),changefreq:'daily',priority:'0.8'})),
    ...players.filter(item=>Number.isFinite(Number(item.id))).map(item=>entry(`/player/${Number(item.id)}`,{lastmod:validDate(item.created_at),changefreq:'weekly',priority:'0.7'})),
    ...competitions.filter(item=>Number.isFinite(Number(item.id))).map(item=>entry(`/competition/${Number(item.id)}`,{lastmod:validDate(item.updated_at),changefreq:'daily',priority:'0.7'})),
    ...matches.filter(item=>Number.isFinite(Number(item.id))).map(item=>entry(`/match/${Number(item.id)}`,{changefreq:'daily',priority:'0.7'}))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}

function safeSupabaseUrl(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='https:'&&url.hostname.endsWith('.supabase.co')?url.origin:'';
  }catch{return'';}
}

async function readAll(baseUrl,key,table,select,order){
  const result=[];
  for(let page=0;page<MAX_PAGES;page+=1){
    const query=new URLSearchParams({select,order:`${order}.asc`});
    const response=await fetch(`${baseUrl}/rest/v1/${table}?${query}`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`,Range:`${page*PAGE_SIZE}-${(page+1)*PAGE_SIZE-1}`},
      signal:AbortSignal.timeout(8_000)
    });
    if(!response.ok)throw new Error(`sitemap_${table}_${response.status}`);
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error(`sitemap_${table}_invalid_response`);
    result.push(...rows);
    if(rows.length<PAGE_SIZE)return result;
  }
  return result;
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.setHeader('Allow','GET, HEAD');
    res.status(405).end('Method not allowed');
    return;
  }

  const baseUrl=safeSupabaseUrl(process.env.SUPABASE_URL);
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  let data={};
  let degraded=false;
  if(baseUrl&&key){
    try{
      const [clubs,players,competitions,matches]=await Promise.all([
        readAll(baseUrl,key,'clubs','id,updated_at','id'),
        readAll(baseUrl,key,'players','id,created_at','id'),
        readAll(baseUrl,key,'competitions','id,updated_at','id'),
        readAll(baseUrl,key,'matches','id','id')
      ]);
      data={clubs,players,competitions,matches};
    }catch(error){
      degraded=true;
      console.error('Sitemap data error:',error instanceof Error?error.message:'unknown');
    }
  }else degraded=true;

  const body=buildSitemap(data);
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Cache-Control',degraded?'public, s-maxage=300':'public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.status(200).end(req.method==='HEAD'?'':body);
};

module.exports.buildSitemap=buildSitemap;
module.exports.safeSupabaseUrl=safeSupabaseUrl;
