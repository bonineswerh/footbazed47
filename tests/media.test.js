'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const media=require('../js/media.js');

test('missing and unverified assets resolve to the fallback path',()=>{
  assert.equal(media.resolveAsset(null,'club_logo'),null);
  assert.equal(media.resolveAsset({asset_type:'club_logo',usage_status:'unknown',url:'https://media.example/logo.png'},'club_logo'),null);
  assert.equal(media.resolveAsset({asset_type:'club_logo',usage_status:'restricted',url:'https://media.example/logo.png'},'club_logo'),null);
  assert.match(media.visual({entity:{id:1,name:'No Logo FC'},kind:'club'}),/is-fallback/u);
  assert.match(media.visual({entity:{id:2,name:'No Photo Player'},kind:'player'}),/Фото No Photo Player отсутствует/u);
  assert.match(media.visual({entity:{id:3,name:'No Logo League'},kind:'competition'}),/Логотип No Logo League/u);
});

test('only a matching VERIFIED HTTPS asset is rendered',()=>{
  const verified={asset_type:'club_logo',usage_status:'verified',url:'https://media.example/logo.png',source_provider:'licensed'};
  assert.equal(media.resolveAsset(verified,'club_logo').url,'https://media.example/logo.png');
  assert.equal(media.resolveAsset(verified,'player_photo'),null);
  assert.equal(media.resolveAsset({...verified,url:'http://media.example/logo.png'},'club_logo'),null);
  assert.match(media.visual({entity:{name:'Verified FC',media:verified},kind:'club'}),/has-image/u);
});

test('media providers are explicit and disabled until registered',async()=>{
  await assert.rejects(media.resolveFromProvider('missing',{kind:'club'}),/not_registered/u);
  const id=`test_provider_${Date.now()}`;
  media.registerProvider({id,resolve:request=>({request,usage_status:'unknown'})});
  assert.equal((await media.resolveFromProvider(id,{kind:'club'})).usage_status,'unknown');
});
