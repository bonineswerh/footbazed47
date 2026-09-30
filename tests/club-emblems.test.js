'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {matchClubEmblems,prepareClubEmblems}=require('../server/football/club-emblems');
const club={id:31,external_id:65,name:'Manchester City FC',short_name:'Man City',area_name:'England'};
const team=(id=50,name='Manchester City',country='England')=>({team:{id,name,country,logo:`https://media.api-sports.io/football/teams/${id}.png`}});

test('logo matching keeps internal and football-data identities separate from API-Football IDs',()=>{
  const result=matchClubEmblems([team()],[club]);
  assert.equal(result.items[0].club_id,31);assert.equal(result.items[0].legacy_external_id,65);assert.equal(result.items[0].provider_id,50);
  assert.equal(result.items[0].source_url,'https://media.api-sports.io/football/teams/50.png');
});
test('country, ambiguous names and provider mapping conflicts are never guessed',()=>{
  for(const [clubs,mappings]of [[[club,{...club,id:32}],[]],[[{...club,area_name:'Spain'}],[]],[[club],[{club_id:31,external_id:51}]],[[{...club,name:'Other FC',short_name:'Other'}],[{club_id:31,external_id:50}]]]){
    const result=matchClubEmblems([team()],clubs,mappings);assert.equal(result.items.length,0);assert.equal(result.skipped.length,1);
  }
  const mapped=matchClubEmblems([team()],[club,{...club,id:32}],[{club_id:31,external_id:50}]);assert.equal(mapped.items.length,1);
});
test('malformed teams, repeated IDs, arbitrary URLs and redirects cannot become assets',()=>{
  for(const rows of [[],[team(),team()],[team(-1)],[{team:{...team().team,logo:'https://evil.test/50.png'}}],[{team:{...team().team,logo:'https://media.api-sports.io/football/teams/50.png?token=private'}}],[team(50,'')]])assert.throws(()=>matchClubEmblems(rows,[club]),error=>error.code==='provider_invalid_teams');
});
test('emblems use one bounded catalogue call and preserve quotas and skipped candidates',async()=>{
  const calls=[];
  const result=await prepareClubEmblems({collection:async(...args)=>{calls.push(args);return{items:[team(),team(99,'Unmapped FC')],quota:{dailyRemaining:98}};}},'PL',2024,[club],[]);
  assert.deepEqual(calls,[['/teams',{league:39,season:2024},{maxPages:1,maxItems:120}]]);assert.equal(result.items.length,1);assert.equal(result.skipped.length,1);assert.equal(result.quota.dailyRemaining,98);
  await assert.rejects(prepareClubEmblems({},'OTHER',2024,[],[]),error=>error.code==='invalid_provider_parameters');
});
