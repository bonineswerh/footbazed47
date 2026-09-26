'use strict';

const PRODUCTION_SUPABASE_URL='https://uukacnyvjvgmmhbkmfzf.supabase.co';
const PRODUCTION_PUBLISHABLE_KEY='sb_publishable_rLano6D68MF7Q25nzpY3hw_Qu5pLgNs';

function isCI(environment){
  return Boolean(environment.CI)&&!['false','0'].includes(String(environment.CI).toLowerCase());
}

function normalizeSupabaseUrl(value){
  try{
    const url=new URL(String(value||'').trim());
    const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if(url.username||url.password||url.search||url.hash||!/^\/*$/.test(url.pathname))return '';
    if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))return '';
    return url.origin;
  }catch{return '';}
}

function isProductionSupabaseUrl(value){
  try{
    return new URL(String(value||'').trim()).hostname.toLowerCase().replace(/\.$/,'')
      ===new URL(PRODUCTION_SUPABASE_URL).hostname;
  }catch{return false;}
}

function isPublicSupabaseKey(value){
  const key=String(value||'').trim();
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;
  try{
    const parts=key.split('.');
    return parts.length===3&&JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role==='anon';
  }catch{return false;}
}

function resolveRuntimeConfig(environment=process.env,{local=false}={}){
  const name=local?'development':environment.VERCEL_ENV||environment.FOOTBAZED_ENV||'development';
  const production=!local&&environment.VERCEL==='1'&&name==='production';
  const rawUrl=environment.SUPABASE_PUBLIC_URL||(production?(environment.SUPABASE_URL||PRODUCTION_SUPABASE_URL):(local?environment.SUPABASE_URL:''));
  const key=String(environment.SUPABASE_PUBLISHABLE_KEY||environment.SUPABASE_ANON_KEY||(production?PRODUCTION_PUBLISHABLE_KEY:'')).trim();
  if(!rawUrl||!key)return {environment:name,error:'runtime_config_missing'};
  const url=normalizeSupabaseUrl(rawUrl);
  if(!url)return {environment:name,error:'runtime_config_invalid_url'};
  const override=local&&!isCI(environment)&&!environment.VERCEL&&!environment.VERCEL_ENV&&environment.FOOTBAZED_ALLOW_PRODUCTION==='1';
  if(!production&&!override&&isProductionSupabaseUrl(url))return {environment:name,error:'production_supabase_blocked'};
  if(!isPublicSupabaseKey(key))return {environment:name,error:'unsafe_runtime_key'};
  return {environment:name,supabaseUrl:url,supabaseKey:key};
}

function sendScript(res,status,payload,head=false){
  res.statusCode=status;
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(head?'':`window.__FOOTBAZED_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify(payload)});`);
}

module.exports=function handler(req,res){
  const head=req.method==='HEAD';
  if(req.method!=='GET'&&!head)return sendScript(res,405,{error:'runtime_config_method_not_allowed'});

  const payload=resolveRuntimeConfig();
  return sendScript(res,payload.error?503:200,payload,head);
};

module.exports.resolveRuntimeConfig=resolveRuntimeConfig;
module.exports.isProductionSupabaseUrl=isProductionSupabaseUrl;
module.exports.isPublicSupabaseKey=isPublicSupabaseKey;
module.exports.isCI=isCI;
