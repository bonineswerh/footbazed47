'use strict';

const PRODUCTION_SUPABASE_URL='https://uukacnyvjvgmmhbkmfzf.supabase.co';
const LEGACY_PRODUCTION_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1a2Fjbnl2anZnbW1oYmttZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDM3MzcsImV4cCI6MjA4NzA3OTczN30.hZIYkrWFqRwu0IciG2iF3TyP8WnVQcV1sFyjfeVUpRc';

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

  const environment=process.env.VERCEL_ENV||process.env.FOOTBAZED_ENV||'development';
  const isProduction=environment==='production';
  const supabaseUrl=process.env.SUPABASE_PUBLIC_URL
    ||(isProduction?(process.env.SUPABASE_URL||PRODUCTION_SUPABASE_URL):'');
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY
    ||process.env.SUPABASE_ANON_KEY
    ||(isProduction?LEGACY_PRODUCTION_ANON_KEY:'');

  if(!supabaseUrl||!supabaseKey){
    return sendScript(res,503,{environment,error:'runtime_config_missing'},head);
  }
  if(!isProduction&&supabaseUrl===PRODUCTION_SUPABASE_URL){
    return sendScript(res,503,{environment,error:'production_supabase_blocked'},head);
  }

  return sendScript(res,200,{environment,supabaseUrl,supabaseKey},head);
};
