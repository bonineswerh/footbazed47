'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/config.js');

const managedKeys=['VERCEL_ENV','FOOTBAZED_ENV','SUPABASE_PUBLIC_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY'];

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
