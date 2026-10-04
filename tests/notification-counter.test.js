'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function counter(){
  const listeners={},requests=[],timers=new Map(),badge={textContent:'',classList:{toggle(){}}};
  const document={hidden:false,getElementById:id=>id==='notifBadge'?badge:null,dispatchEvent(){},addEventListener:(event,handler)=>{listeners[event]=handler;}};
  const window={addEventListener:(event,handler)=>{listeners[event]=handler;}};
  const sb={from(table){assert.equal(table,'notifications');let user;
    const query={select(fields,options){assert.equal(fields,'id');assert.deepEqual({...options},{count:'exact',head:true});return query;},eq(key,value){if(key==='user_id')user=value;return query;},then(resolve){requests.push({user,resolve});}};
    return query;
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/notification-counter.js'),'utf8'),{
    window,document,sb,CustomEvent:class{},FBZDomain:{countLabel:n=>String(n)},
    setTimeout:handler=>{const id=timers.size+1;timers.set(id,handler);return id;},clearTimeout:id=>timers.delete(id)
  });
  return{api:window.FBZNotificationCounter,listeners,requests,badge,timers};
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
  c.api.syncSession('third');c.requests[1].resolve({count:9});await next;await Promise.resolve();
  assert.equal(c.badge.textContent,'0');assert.equal(c.requests[2].user,'third');
  c.requests[2].resolve({count:2});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.badge.textContent,'2');
});
