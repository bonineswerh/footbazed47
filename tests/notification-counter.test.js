'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function counter(){
  const listeners={},requests=[],timers=new Map(),badge={textContent:'',classList:{toggle(){}}};let timerId=0;
  const document={hidden:false,getElementById:id=>id==='notifBadge'?badge:null,dispatchEvent(){},addEventListener:(event,handler)=>{listeners[event]=handler;}};
  const window={addEventListener:(event,handler)=>{listeners[event]=handler;}};
  const sb={from(table){assert.equal(table,'notifications');let user;
    const query={select(fields,options){assert.equal(fields,'id');assert.deepEqual({...options},{count:'exact',head:true});return query;},eq(key,value){if(key==='user_id')user=value;return query;},abortSignal(signal){query.signal=signal;return query;},then(resolve){requests.push({user,resolve,signal:query.signal});}};
    return query;
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/notification-counter.js'),'utf8'),{
    window,document,sb,AbortController,CustomEvent:class{},FBZDomain:{countLabel:n=>String(n)},
    setTimeout:(handler,delay)=>{const id=++timerId;timers.set(id,{handler,delay});return id;},clearTimeout:id=>timers.delete(id)
  });
  return{api:window.FBZNotificationCounter,listeners,requests,badge,timers,document};
}
test('notification focus and visibility are safe before the app session exists',async()=>{
  const c=counter();await c.listeners.focus();await c.listeners.visibilitychange();
  assert.equal(c.requests.length,0);assert.equal(c.timers.size,0);
  c.api.syncSession('first');const request=c.api.refresh();await Promise.resolve();
  assert.equal(c.requests[0].user,'first');c.requests[0].resolve({count:3});await request;
  assert.equal(c.badge.textContent,'3');c.api.syncSession('first');assert.equal(c.badge.textContent,'3');
});
test('an in-flight notification response cannot restore a signed-out or previous account count',async()=>{
  const c=counter();c.api.syncSession('first');const request=c.api.refresh();await Promise.resolve();
  c.api.resetSession();c.requests[0].resolve({count:8});await request;
  assert.equal(c.badge.textContent,'0');assert.equal(c.timers.size,0);
  c.api.syncSession('second');const next=c.api.refresh();await Promise.resolve();
  c.api.syncSession('third');const latest=c.api.refresh();await Promise.resolve();
  assert.equal(c.requests[1].signal.aborted,true);c.requests[1].resolve({count:9});await next;
  assert.equal(c.badge.textContent,'0');assert.equal(c.requests[2].user,'third');
  c.requests[2].resolve({count:2});await latest;
  assert.equal(c.badge.textContent,'2');
});

test('a confirmed read count cancels an older count request and remains authoritative',async()=>{
  const c=counter();c.api.syncSession('first');const request=c.api.refresh();await Promise.resolve();
  c.api.set(2);assert.equal(c.requests[0].signal.aborted,true);
  c.requests[0].resolve({count:8});await request;assert.equal(c.badge.textContent,'2');
  assert.equal([...c.timers.values()].at(-1).delay,30000);
});

test('notification polling accelerates only while the center is open',async()=>{
  const c=counter();c.api.syncSession('first');c.api.setFastPolling(true);
  assert.equal([...c.timers.values()].at(-1).delay,15000);
  c.api.setFastPolling(false);assert.equal([...c.timers.values()].at(-1).delay,30000);
  c.document.hidden=true;c.listeners.visibilitychange();assert.equal(c.timers.size,0);
  assert.equal(c.requests.length,0);
});

test('a stalled count request times out, preserves the last count and allows retry',async()=>{
  const c=counter();c.api.syncSession('first');c.api.set(4);const request=c.api.refresh();await Promise.resolve();
  [...c.timers.values()].find(timer=>timer.delay===8000).handler();
  assert.equal(c.requests[0].signal.aborted,true);c.requests[0].resolve({error:{name:'AbortError'}});await request;
  assert.equal(c.badge.textContent,'4');assert.equal([...c.timers.values()].at(-1).delay,30000);
  const retry=c.api.refresh();await Promise.resolve();c.requests[1].resolve({count:5});await retry;
  assert.equal(c.badge.textContent,'5');
});

test('hiding the page cancels pending IO and an old response cannot overwrite the return refresh',async()=>{
  const c=counter();c.api.syncSession('first');const old=c.api.refresh();await Promise.resolve();
  c.document.hidden=true;c.listeners.visibilitychange();assert.equal(c.requests[0].signal.aborted,true);
  c.document.hidden=false;const current=c.listeners.visibilitychange();await Promise.resolve();
  c.requests[1].resolve({count:3});await current;await new Promise(resolve=>setImmediate(resolve));c.requests[0].resolve({count:7});await old;
  assert.equal(c.badge.textContent,'3');
});
