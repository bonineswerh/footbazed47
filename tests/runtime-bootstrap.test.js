'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(require.resolve('../js/core.js'),'utf8');

function boot({hostname='localhost',search='',key='sb_publishable_fixture',testClient=null}={}){
  let created=0;
  const window={
    location:{hostname,search,origin:`http://${hostname}`},
    __FOOTBAZED_RUNTIME_CONFIG__:{environment:'development',supabaseUrl:'http://127.0.0.1:54321',supabaseKey:key},
    __FOOTBAZED_TEST_CLIENT__:testClient,
    supabase:{createClient(){created++;return {real:true};}}
  };
  vm.runInNewContext(source,{window,URL,URLSearchParams,atob,console});
  return {window,created};
}

test('test client bootstrap requires exact local __e2e=1 opt-in',()=>{
  const testClient={fake:true};
  assert.equal(boot({search:'?__e2e=1',testClient}).window.sb,testClient);
  for(const options of [{search:'?__e2e=0'},{search:'?__e2e'},{hostname:'example.test',search:'?__e2e=1'}]){
    const result=boot({...options,testClient});
    assert.equal(result.created,1);
    assert.notEqual(result.window.sb,testClient);
  }
});

test('client bootstrap fails closed for privileged and invalid runtime keys',()=>{
  for(const key of ['sb_secret_fixture','invalid-key',`header.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`]){
    const result=boot({key});
    assert.equal(result.created,0);
    assert.equal(result.window.sb,null);
    assert.equal(result.window.FBZ_BOOT_ERROR,'unsafe_runtime_key');
  }
});

test('demo fixture only installs a client on explicit local test pages',async()=>{
  const {createDemoFixture}=await import('../scripts/demo-fixture.mjs');
  const fixture=await createDemoFixture();
  for(const [hostname,search,enabled] of [['127.0.0.1','?__e2e=1',true],['localhost','?__e2e=0',false],['example.test','?__e2e=1',false]]){
    const context={window:{},location:{hostname,search},URLSearchParams,structuredClone,localStorage:{setItem(){}}};
    vm.runInNewContext(fixture,context);
    assert.equal(Boolean(context.window.__FOOTBAZED_TEST_CLIENT__),enabled);
    if(enabled){
      const response=await context.window.__FOOTBAZED_TEST_CLIENT__.rpc('get_my_profile');
      assert.equal(response.data.username,'bazed');
    }
  }
});
