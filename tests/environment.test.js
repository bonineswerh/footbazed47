'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');

test('environment policy rejects production bindings in CI',async()=>{
  const {validateEnvironment}=await import('../scripts/check-environment.mjs');
  const violations=validateEnvironment({
    environment:{CI:'true',SUPABASE_PUBLIC_URL:'https://uukacnyvjvgmmhbkmfzf.supabase.co'},
    files:[]
  });
  assert.deepEqual(violations,['SUPABASE_PUBLIC_URL points to the production Supabase project']);
});

test('environment policy rejects a production ref stored in a local env file',async()=>{
  const {validateEnvironment}=await import('../scripts/check-environment.mjs');
  const violations=validateEnvironment({
    environment:{},
    files:[{name:'.env.local',contents:'SUPABASE_URL=https://uukacnyvjvgmmhbkmfzf.supabase.co'}]
  });
  assert.deepEqual(violations,['.env.local contains the production Supabase project ref']);
});

test('environment policy permits a separate development project',async()=>{
  const {validateEnvironment}=await import('../scripts/check-environment.mjs');
  assert.deepEqual(validateEnvironment({
    environment:{SUPABASE_PUBLIC_URL:'https://footbazed-dev.supabase.co'},
    files:[]
  }),[]);
});

test('CI cannot enable the production escape hatch',async()=>{
  const {validateEnvironment}=await import('../scripts/check-environment.mjs');
  assert.deepEqual(validateEnvironment({
    environment:{CI:'true',FOOTBAZED_ALLOW_PRODUCTION:'1'},
    files:[]
  }),['FOOTBAZED_ALLOW_PRODUCTION cannot be enabled in CI']);
});
