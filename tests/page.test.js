'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {routeFromPath,resolvePage,renderDocument}=require('../api/page.js');
const seo=require('../js/seo.js');
const config={supabaseUrl:'https://public.example.test',supabaseKey:'sb_publishable_test'};
const html=readFileSync(require.resolve('../index.html'),'utf8');

test('retired match chat returns 410 without accessing user data',async()=>{
  const result=await resolvePage(routeFromPath('/match/101/chat'),config,()=>{throw Error('No lookup allowed');});
  assert.equal(result.status,410);
  assert.equal(result.metadata.index,false);
  assert.match(result.metadata.title,/Чаты закрыты/);
});

test('server and client share entity metadata without inventing photos or logos',async()=>{
  for(const [kind,value] of Object.entries({club:{id:24,name:'Real Madrid CF'},player:{id:5292,name:'Jude Bellingham'},competition:{id:7,name:'Champions League'},match:{id:101,home_team_name:'Real Madrid',away_team_name:'Man City',match_date:'2026-09-29T18:00:00Z'}})){
    let request;
    const result=await resolvePage(routeFromPath(`/${kind}/${value.id}`),config,async(url,options)=>{request={url,options};return {ok:true,json:async()=>[value]};});
    assert.equal(result.status,200);
    assert.deepEqual(result.metadata,seo[kind](value));
    assert.equal(result.metadata.path,`/${kind}/${value.id}`);
    assert.deepEqual(request.options.headers,{apikey:'sb_publishable_test'});
    const document=renderDocument(html,result.metadata);
    assert.match(document,new RegExp(`<link rel="canonical" href="https://footbazed47.vercel.app/${kind}/${value.id}"`));
    assert.match(document,/id="fbzStructuredData"/);
    assert.equal(result.metadata.structuredData.logo,undefined);
    if(kind==='player')assert.equal(result.metadata.structuredData.image,undefined);
  }
});
test('public documents cannot include private profile data, even with caller cookies',async()=>{
  const result=await resolvePage(routeFromPath('/profile/3615141a-7700-46b8-9ba5-e4f4450537fc'),config,()=>{throw new Error('Profiles must not be queried');});
  assert.equal(result.metadata.index,false);
  assert.equal(result.metadata.structuredData,null);
  assert.equal(result.metadata.title,'Профиль — FOOTBAZED');
});
test('missing entities return real 404 metadata; network failure is not a false 404',async()=>{
  const route=routeFromPath('/player/999');
  const absent=await resolvePage(route,config,async()=>({ok:true,json:async()=>[]}));
  assert.equal(absent.status,404);assert.equal(absent.metadata.index,false);
  await assert.rejects(resolvePage(route,config,async()=>({ok:false})),/public_data_unavailable/);
  for(const path of ['/player/-1','/player/1/chat','/player/1/extra'])assert.equal(routeFromPath(path).kind,'missing');
});
test('server metadata escapes HTML and JSON script termination',()=>{
  const document=renderDocument(html,seo.player({id:1,name:'</script><script>alert("x")</script>&'}));
  assert.doesNotMatch(document,/<script>alert/);
  assert.match(document,/\\u003c\/script\\u003e/);
  assert.match(document,/&lt;\/script&gt;/);
  assert.doesNotMatch(document,/\$REPLACEMENT\$/);
});
test('legacy overview URL receives the canonical discover metadata',async()=>{
  assert.equal((await resolvePage(routeFromPath('/leaderboard'),config)).metadata.path,'/discover');
});
