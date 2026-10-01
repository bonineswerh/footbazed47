'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {matchClubEmblems,prepareClubEmblems,prepareMissingClubEmblem}=require('../server/football/club-emblems');
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
test('explicit club aliases resolve catalogue naming differences without weakening country checks',()=>{
  const variants=[['Ipswich Town FC','Ipswich','England'],['Leeds United FC','Leeds','England'],['Como 1907','Como','Italy'],['1. FSV Mainz 05','FSV Mainz 05','Germany'],['SV Werder Bremen','Werder Bremen','Germany'],['TSG 1899 Hoffenheim','Hoffenheim','Germany'],['Angers SCO','Angers','France'],['PSV','PSV Eindhoven','Netherlands'],['ŠK Slovan Bratislava','Slovan Bratislava','Slovakia'],['LASK Linz','LASK','Austria'],['PAE AEK','AEK Athens','Greece'],['Coventry City FC','Coventry','England'],['Real Racing Club de Santander','Racing Santander','Spain']];
  variants.forEach(([local,remote,country],index)=>{
    const candidate={...club,id:100+index,name:local,short_name:null,area_name:country};
    assert.equal(matchClubEmblems([team(200+index,remote,country)],[candidate]).items[0]?.club_id,candidate.id);
    assert.equal(matchClubEmblems([team(200+index,remote,'Other country')],[candidate]).items.length,0);
  });
  for(const [local,remote,country]of [['TSG 1899 Hoffenheim','1899 Hoffenheim','Germany'],['SV 07 Elversberg','SV Elversberg','Germany'],['1. FC Köln','FC Koln','Germany'],['ES Troyes AC','Estac Troyes','France']]){
    assert.equal(matchClubEmblems([team(999,remote,country)],[{...club,name:local,short_name:null,area_name:country}]).items.length,1);
  }
  const monaco={...club,name:'AS Monaco FC',short_name:null,area_name:'Monaco'};
  assert.equal(matchClubEmblems([team(91,'Monaco','France')],[monaco]).items.length,1);
  assert.equal(matchClubEmblems([team(91,'Monaco','Italy')],[monaco]).items.length,0);
  assert.equal(matchClubEmblems([team(50,'Manchester City','France')],[{...club,area_name:'Monaco'}]).items.length,0);
});
test('emblems use one bounded catalogue call and preserve quotas and skipped candidates',async()=>{
  const calls=[];
  const result=await prepareClubEmblems({collection:async(...args)=>{calls.push(args);return{items:[team(),team(99,'Unmapped FC')],quota:{dailyRemaining:98}};}},'PL',2024,[club],[]);
  assert.deepEqual(calls,[['/teams',{league:39,season:2024},{maxPages:1,maxItems:120}]]);assert.equal(result.items.length,1);assert.equal(result.skipped.length,1);assert.equal(result.quota.dailyRemaining,98);
  await assert.rejects(prepareClubEmblems({},'OTHER',2024,[],[]),error=>error.code==='invalid_provider_parameters');
});

test('direct lookup checks country and identity, has no season claim and consumes one call',async()=>{
  const calls=[],provider={...team().team,national:false,founded:1880};
  const result=await prepareMissingClubEmblem({collection:async(...args)=>{calls.push(args);return {items:[{team:provider},team(51,'Manchester City','Other country')],quota:{dailyRemaining:95}};}},{...club,founded:1880,logo_asset_id:null});
  assert.deepEqual(calls,[['/teams',{search:'Man City'},{maxPages:1,maxItems:120}]]);
  assert.equal(result.items[0].provider_id,50);assert.equal(result.items[0].legacy_external_id,65);
  assert.equal(result.season,null);assert.equal(result.league,null);assert.equal(result.lookup,'team-search');assert.equal(result.quota.dailyRemaining,95);
});
test('direct lookup refuses ambiguity, national teams, conflicting founding years and mapping conflicts',async()=>{
  const row=(id=50,extra={})=>({team:{...team(id).team,national:false,founded:1880,...extra}});
  for(const [rows,mappings]of [[[row(),row(51)],[]],[[row(50,{national:true})],[]],[[row(50,{founded:1900})],[]],[[row()],[{club_id:31,external_id:51}]],[[row(50,{country:'Spain'})],[]]]){
    const result=await prepareMissingClubEmblem({collection:async()=>({items:rows,quota:{}})},{...club,founded:1880},mappings);assert.equal(result.items.length,0);
  }
  await assert.rejects(prepareMissingClubEmblem({collection:async()=>({items:[row(),row()]})},club),e=>e.code==='provider_invalid_teams');
  const empty=await prepareMissingClubEmblem({collection:async()=>({items:[],quota:{}})},club);assert.equal(empty.items.length,0);
  await assert.rejects(prepareMissingClubEmblem({}, {...club,logo_asset_id:1}),e=>e.code==='club_emblem_not_missing');
});
