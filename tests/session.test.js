'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const dataSource=readFileSync(require.resolve('../js/data.js'),'utf8');
const authSource=readFileSync(require.resolve('../js/auth.js'),'utf8');

function dataHarness(rpc){
  const window={sb:{rpc},FBZDomain:require('../js/domain.js')};
  vm.runInNewContext(dataSource,{window,structuredClone,setTimeout,clearTimeout});
  return window.FBZData;
}
test('comparison responses cannot cross account changes and are not cached',async()=>{
  let complete;
  const data=dataHarness(()=>new Promise(resolve=>{complete=resolve;}));
  data.setSessionUser('viewer');
  const pending=data.getProfileComparisonPage('target');
  data.setSessionUser('other');complete({data:{items:[],summary:{total:3}}});
  await assert.rejects(pending,{name:'AbortError'});
  let calls=0;
  const fresh=dataHarness(async()=>({data:{items:[],summary:{total:++calls}}}));
  assert.equal((await fresh.getProfileComparisonPage('target')).summary.total,1);
  assert.equal((await fresh.getProfileComparisonPage('target')).summary.total,2);
});

test('profile payloads cannot cross account changes or logout',async()=>{
  let viewer='owner';
  let calls=0;
  const data=dataHarness(async()=>{
    calls++;
    return {data:{profile:{id:'owner'},ratings:viewer==='owner'?[{is_public:false}]:[]}};
  });
  data.setSessionUser(viewer);
  assert.equal((await data.getProfilePage('owner')).ratings.length,1);
  await data.getProfilePage('owner');
  assert.equal(calls,1);
  viewer='other';
  data.setSessionUser(viewer);
  assert.equal((await data.getProfilePage('owner')).ratings.length,0);
  assert.equal(calls,2);
  data.setSessionUser(null);
  await data.getProfilePage('owner');
  assert.equal(calls,3);
});

test('an old account request cannot complete or refill the cache after logout',async()=>{
  let resolveOld;
  let calls=0;
  const data=dataHarness(()=>++calls===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({data:null}));
  data.setSessionUser('owner');
  const pending=data.getProfilePage('owner');
  data.setSessionUser(null);
  resolveOld({data:{ratings:[{is_public:false}]}});
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(await data.getProfilePage('owner'),null);
  assert.equal(calls,2);
});

test('invalidating a profile during a read does not cache that stale result',async()=>{
  let resolveOld;
  let calls=0;
  const data=dataHarness(()=>++calls===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({data:{fresh:true}}));
  const pending=data.getProfilePage('owner');
  data.invalidate('profile:');
  resolveOld({data:{fresh:false}});
  await pending;
  assert.equal((await data.getProfilePage('owner')).fresh,true);
  assert.equal(calls,2);
});

test('token refresh keeps a valid session cache and callers cannot mutate cached data',async()=>{
  let calls=0;
  const data=dataHarness(async()=>({data:{profile:{id:String(++calls)}}}));
  data.setSessionUser('owner');
  const profile=await data.getProfilePage('owner');
  profile.profile.id='mutated';
  data.setSessionUser('owner');
  assert.equal((await data.getProfilePage('owner')).profile.id,'1');
  assert.equal(calls,1);
});

test('optional club marks load in one bounded batch and failures preserve the match data',async()=>{
  const calls=[];
  const data=dataHarness(async(name,args)=>{calls.push({name,args});return{data:[{id:1,name:'Home',media:{url:'logo'}}]};});
  const matches=Array.from({length:48},(_,i)=>({id:i,home_club_id:1,away_club_id:i+2}));
  await data.enrichMatchMedia(matches);
  assert.equal(calls.length,1);assert.equal(calls[0].name,'get_club_marks');assert.equal(calls[0].args.p_ids.length,49);
  assert.equal(matches[0].home_club.id,1);await data.enrichMatchMedia(matches);assert.equal(calls.length,1);
  const failed=dataHarness(async()=>({error:{message:'unavailable'}}));
  const plain=[{id:101,home_club_id:1,away_club_id:2}];await failed.enrichMatchMedia(plain);assert.equal(plain[0].id,101);
});

function authHarness(){
  const calls=[];
  let completeProfile;
  const context={
    CU:{id:'old'},
    document:{readyState:'loading',addEventListener(){},documentElement:{classList:{add(){},remove(){}}}},
    localStorage:{setItem(){},removeItem(){}},
    renderNav(){},loadNotifications(){},console,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    window:{
      FBZData:{setSessionUser:id=>calls.push(['data',id])},
      FBZFeed:{resetSession:()=>calls.push(['feed'])},
      FBZSearch:{resetSession:()=>calls.push(['search'])},
      clearAppCache:()=>calls.push(['cache']),
      dispatchEvent:event=>calls.push(['event',event.detail.userId])
    },
    sb:{rpc(name){
      if(name==='get_my_profile')return {maybeSingle:()=>new Promise(resolve=>{completeProfile=resolve;})};
      return Promise.resolve({data:[]});
    }}
  };
  vm.createContext(context);
  vm.runInContext(authSource,context);
  return {context,calls,complete:result=>completeProfile(result)};
}

test('login clears the previous identity before loading and runs domain reset hooks',async()=>{
  const harness=authHarness();
  const pending=harness.context.onLogin({id:'new',email:'local@example.test'});
  assert.equal(harness.context.CU,null);
  assert.deepEqual(harness.calls.map(call=>call[0]),['data','feed','search','cache','event']);
  harness.complete({data:{id:'new',username:'new'}});
  assert.equal(await pending,true);
  assert.equal(harness.context.CU.id,'new');
  const count=harness.calls.length;
  await harness.context.onLogin({id:'new'});
  assert.equal(harness.calls.length,count);
});

test('logout prevents a pending profile response from restoring private state',async()=>{
  const harness=authHarness();
  const pending=harness.context.onLogin({id:'new'});
  harness.context.onLogout();
  harness.complete({data:{id:'new',username:'new'}});
  assert.equal(await pending,false);
  assert.equal(harness.context.CU,null);
  assert.deepEqual(harness.calls.at(-1),['event',null]);
});
