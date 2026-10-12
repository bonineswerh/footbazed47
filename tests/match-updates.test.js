'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
  const timers=new Map(),listeners={},requests=[];let seq=0,now=Date.parse('2026-10-11T16:00:00Z');
  const document={hidden:false,addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const navigator={onLine:true};
  const window={addEventListener:(name,fn)=>{listeners[name]=fn;},sb:{from(table){
    assert.equal(table,'matches');const request={};
    const query={select(fields){assert.equal(fields,'id,status,home_score,away_score,match_date');return query;},in(key,ids){assert.equal(key,'id');request.ids=ids;return query;},limit(value){assert.equal(value,48);return query;},abortSignal(signal){request.signal=signal;return query;},then(resolve){request.resolve=resolve;requests.push(request);}};return query;
  }}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/match-updates.js'),'utf8'),{window,document,navigator,AbortController,Date:class extends Date{static now(){return now;}},setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  async function tick(){const entry=[...timers.entries()].find(([,item])=>item.ms!==8000);assert.ok(entry);timers.delete(entry[0]);const result=entry[1].fn();await Promise.resolve();return{result};}
  return{api:window.FBZMatchUpdates,document,navigator,listeners,requests,timers,tick,advance:ms=>{now+=ms;}};
}
const fixture=(id=1)=>({id,status:'live',home_score:0,away_score:0,match_date:'2026-10-11T16:00:00Z'});
test('one bounded read updates changed matches and stops after a confirmed finish',async()=>{
  const c=setup(),updates=[];c.api.watch({items:[fixture(),fixture()],isCurrent:()=>true,apply:rows=>updates.push(rows)});
  const{result}=await c.tick();assert.equal(c.requests[0].ids.length,1);
  c.requests[0].resolve({data:[{...fixture(),status:'finished',home_score:2}]});await result;
  assert.equal(updates[0][0].home_score,2);assert.equal(c.timers.size,0);
});
test('route changes and hidden tabs abort pending reads and reject late responses',async()=>{
  const c=setup(),updates=[];const watch=()=>c.api.watch({items:[fixture()],isCurrent:()=>true,apply:rows=>updates.push(rows)});
  watch();let pending=await c.tick();c.api.stop();assert.equal(c.requests[0].signal.aborted,true);
  c.requests[0].resolve({data:[{...fixture(),home_score:2}]});await pending.result;assert.equal(updates.length,0);
  watch();pending=await c.tick();c.document.hidden=true;c.listeners.visibilitychange();
  c.requests[1].resolve({data:[{...fixture(),home_score:3}]});await pending.result;assert.equal(updates.length,0);assert.equal(c.timers.size,0);
});
test('focused forms can defer an update without consuming it and transient errors retain scores',async()=>{
  const c=setup();let blocked=true,calls=0;
  c.api.watch({items:[fixture()],isCurrent:()=>true,apply:()=>{calls++;return !blocked;}});
  let pending=await c.tick();c.requests[0].resolve({data:[{...fixture(),home_score:1}]});await pending.result;
  blocked=false;pending=await c.tick();c.requests[1].resolve({data:[{...fixture(),home_score:1}]});await pending.result;assert.equal(calls,2);
  pending=await c.tick();c.requests[2].resolve({error:{message:'unavailable'}});await pending.result;assert.equal(calls,2);assert.ok(c.timers.size);
});
test('passing kickoff refreshes presentation without inventing a provider status',async()=>{
  const c=setup(),updates=[];const match={...fixture(),status:'scheduled',match_date:'2026-10-11T16:00:30Z'};
  c.api.watch({items:[match],isCurrent:()=>true,apply:rows=>updates.push(rows)});c.advance(60000);
  const pending=await c.tick();c.requests[0].resolve({data:[match]});await pending.result;
  assert.equal(updates.length,1);assert.equal(updates[0][0].status,'scheduled');
});
test('background work is capped, pauses offline and throttles focus events',async()=>{
  const c=setup();c.api.watch({items:Array.from({length:100},(_,i)=>fixture(i+1)),isCurrent:()=>true,apply:()=>{}});
  c.listeners.focus();assert.equal(c.requests.length,0);
  const pending=await c.tick();assert.equal(c.requests[0].ids.length,48);
  c.navigator.onLine=false;c.listeners.offline();assert.equal(c.requests[0].signal.aborted,true);
  c.requests[0].resolve({data:[]});await pending.result;assert.equal(c.timers.size,0);
});
