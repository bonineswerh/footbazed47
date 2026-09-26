'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/config.js');

const managedKeys=['VERCEL','VERCEL_ENV','CI','FOOTBAZED_ENV','FOOTBAZED_ALLOW_PRODUCTION','SUPABASE_PUBLIC_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY'];

function withEnvironment(values,run){
  const previous=Object.fromEntries(managedKeys.map(key=>[key,process.env[key]]));
  managedKeys.forEach(key=>delete process.env[key]);
  Object.assign(process.env,values);
  try{return run();}
  finally{
    managedKeys.forEach(key=>{
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    });
  }
}

function invoke(method='GET'){
  const headers={};
  let body='';
  const response={
    statusCode:0,
    setHeader(name,value){headers[name.toLowerCase()]=value;},
    end(value=''){body+=value;}
  };
  handler({method},response);
  return {status:response.statusCode,headers,body};
}

function readPayload(body){
  const prefix='window.__FOOTBAZED_RUNTIME_CONFIG__=Object.freeze(';
  assert.ok(body.startsWith(prefix));
  return JSON.parse(body.slice(prefix.length,-2));
}

test('preview runtime config fails closed when variables are missing',()=>withEnvironment({VERCEL_ENV:'preview'},()=>{
  const response=invoke();
  assert.equal(response.status,503);
  assert.equal(readPayload(response.body).error,'runtime_config_missing');
}));

test('preview runtime config rejects the production project',()=>withEnvironment({
  VERCEL_ENV:'preview',
  SUPABASE_PUBLIC_URL:'https://uukacnyvjvgmmhbkmfzf.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_preview'
},()=>{
  const response=invoke();
  assert.equal(response.status,503);
  assert.equal(readPayload(response.body).error,'production_supabase_blocked');
}));

test('preview runtime config exposes only explicitly configured public values',()=>withEnvironment({
  VERCEL_ENV:'preview',
  SUPABASE_PUBLIC_URL:'https://preview-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_preview'
},()=>{
  const response=invoke();
  const payload=readPayload(response.body);
  assert.equal(response.status,200);
  assert.equal(payload.environment,'preview');
  assert.equal(payload.supabaseUrl,'https://preview-project.supabase.co');
  assert.equal(payload.supabaseKey,'sb_publishable_preview');
}));

test('runtime config rejects non-read methods',()=>withEnvironment({VERCEL_ENV:'production'},()=>{
  assert.equal(invoke('POST').status,405);
}));

test('production URL spelling variants remain blocked in preview and local runtime',()=>{
  for(const url of [
    'https://uukacnyvjvgmmhbkmfzf.supabase.co/',
    ' https://UUKACNYVJVGMMHBKMFZF.supabase.co/ ',
    'https://UUKACNYVJVGMMHBKMFZF.SUPABASE.CO:443',
    'https://uukacnyvjvgmmhbkmfzf.supabase.co.'
  ]){
    const values={VERCEL_ENV:'preview',SUPABASE_PUBLIC_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_preview'};
    assert.equal(handler.resolveRuntimeConfig(values).error,'production_supabase_blocked');
    assert.equal(handler.resolveRuntimeConfig(values,{local:true}).error,'production_supabase_blocked');
  }
});

test('public config never returns secret keys or privileged JWT payloads',()=>{
  for(const key of ['sb_secret_test_private',`header.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`]){
    const result=handler.resolveRuntimeConfig({SUPABASE_PUBLIC_URL:'https://dev.supabase.co',SUPABASE_PUBLISHABLE_KEY:key});
    assert.equal(result.error,'unsafe_runtime_key');
    assert.equal(result.supabaseKey,undefined);
    assert.ok(!JSON.stringify(result).includes(key));
  }
});

test('only Vercel production gets implicit production defaults',()=>{
  assert.equal(handler.resolveRuntimeConfig({FOOTBAZED_ENV:'production'}).error,'runtime_config_missing');
  assert.equal(handler.resolveRuntimeConfig({VERCEL_ENV:'production'}).error,'runtime_config_missing');
  assert.equal(handler.resolveRuntimeConfig({VERCEL:'1',VERCEL_ENV:'production'}).environment,'production');
  assert.ok(handler.resolveRuntimeConfig({VERCEL:'1',VERCEL_ENV:'production'}).supabaseUrl);
});

test('local production override is unavailable to CI and Vercel',()=>{
  const values={SUPABASE_URL:'https://uukacnyvjvgmmhbkmfzf.supabase.co/',SUPABASE_ANON_KEY:'sb_publishable_test',FOOTBAZED_ALLOW_PRODUCTION:'1'};
  assert.ok(handler.resolveRuntimeConfig(values,{local:true}).supabaseUrl);
  for(const extra of [{CI:'true'},{CI:'1'},{VERCEL:'1',VERCEL_ENV:'preview'}]){
    assert.equal(handler.resolveRuntimeConfig({...values,...extra},{local:true}).error,'production_supabase_blocked');
  }
});

test('runtime config accepts public local keys and rejects URLs with credentials or paths',()=>{
  const key=`header.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`;
  assert.equal(handler.resolveRuntimeConfig({SUPABASE_URL:'http://127.0.0.1:54321/',SUPABASE_ANON_KEY:key},{local:true}).supabaseUrl,'http://127.0.0.1:54321');
  for(const url of ['https://user:password@dev.supabase.co','https://dev.supabase.co/rest/v1','javascript:alert(1)']){
    assert.equal(handler.resolveRuntimeConfig({SUPABASE_PUBLIC_URL:url,SUPABASE_ANON_KEY:key}).error,'runtime_config_invalid_url');
  }
});
