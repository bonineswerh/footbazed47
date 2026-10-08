'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {auditItem,auditPage}=require('../server/football/catalog-status');

test('administrative activity exposes only bounded operation facts, never private audit payloads',()=>{
  const item=auditItem({id:4,action:'sync_matches',target_type:'league',target_id:'PL',actor_id:'private-account',created_at:'2026-10-08T14:00:00Z',metadata:{processed:12,dateFrom:'2026-10-01',dateTo:'2026-10-08',email:'private@example.test',note:'private note',payload:{key:'secret'}}});
  assert.deepEqual(item,{id:4,action:'sync_matches',at:'2026-10-08T14:00:00.000Z',failed:false,league:'PL',processed:12,dateFrom:'2026-10-01',dateTo:'2026-10-08'});
  assert.doesNotMatch(JSON.stringify(item),/private|secret|actor|email|payload/);
});
test('unknown actions and invalid metadata cannot inject operation names or targets',()=>{
  assert.equal(auditItem({id:1,action:'<script>secret</script>',target_type:'league',target_id:'secret',created_at:'2026-10-08',metadata:{processed:-1,dateFrom:'2026-02-30',dateTo:'2026-03-01',status:403}}).action,'other');
  assert.deepEqual(auditItem({id:2,action:'sync_matches_failed',created_at:'2026-10-08',metadata:{status:429}}),{id:2,action:'sync_matches_failed',at:'2026-10-08T00:00:00.000Z',failed:true,status:429});
  assert.equal(auditItem({id:3,created_at:'invalid'}),null);
});
test('audit pagination uses the last delivered ID so newly inserted events do not shift older pages',()=>{
  const rows=Array.from({length:21},(_,i)=>({id:40-i,action:'test_connection',created_at:'2026-10-08'}));
  const page=auditPage(rows);assert.equal(page.items.length,20);assert.equal(page.nextCursor,21);assert.equal(page.hasMore,true);
  assert.equal(auditPage(rows.slice(0,20)).hasMore,false);assert.equal(auditPage([]).nextCursor,null);
  assert.throws(()=>auditPage({}),/invalid_audit_response/);
});
