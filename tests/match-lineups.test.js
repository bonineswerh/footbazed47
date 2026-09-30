'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectFixture,normalizeMatchLineup,prepareMatchLineup}=require('../server/football/match-lineups');
function data(){
  const match={id:1,status:'finished',league_code:'PL',season:'2024',match_date:'2024-03-05T20:00:00Z',home_club_id:24,away_club_id:31};
  const teams={home:541,away:50};
  const fixture={fixture:{id:123,date:match.match_date,status:{short:'FT'}},league:{id:39,season:2024},teams:{home:{id:541},away:{id:50}}};
  const make=(id)=>({team:{id},formation:'4-3-3',startXI:Array.from({length:11},(_,i)=>({player:{id:id*100+i,name:`Test ${id} Player ${i}`,pos:i===0?'G':i<5?'D':i<8?'M':'F',number:i+1,grid:i===0?'1:1':i<5?`2:${i}`:i<8?`3:${i-4}`:`4:${i-7}`}})),substitutes:[{player:{id:id*100+20,name:'Played substitute',pos:'F',number:20,grid:null}},{player:{id:id*100+21,name:'Unused substitute',pos:'M',number:21,grid:null}}]});
  return {match,teams,fixture,lineups:[make(541),make(50)],mappings:[{external_id:54100,player_id:1},{external_id:54120,player_id:2}]};
}
function rejected(fn,code){assert.throws(fn,e=>e.code===code);}
test('fixture identity requires league, season, both numeric teams and exact kickoff window',()=>{
  const d=data();assert.equal(selectFixture([d.fixture],d.match,d.teams).fixture.id,123);
  rejected(()=>selectFixture([{...d.fixture,league:{id:39,season:2023}}],d.match,d.teams),'fixture_identity_not_found');
  rejected(()=>selectFixture([d.fixture,d.fixture],d.match,d.teams),'fixture_identity_ambiguous');
  rejected(()=>selectFixture([{...d.fixture,fixture:{...d.fixture.fixture,date:'2024-03-05T19:00:00Z'}}],d.match,d.teams),'fixture_identity_not_found');
  rejected(()=>selectFixture([d.fixture],{...d.match,api_fixture_id:999},d.teams),'fixture_identity_conflict');
});
test('historical players map by provider ID only; unmapped names remain view-only',()=>{
  const d=data(),p=normalizeMatchLineup(d).players;
  assert.equal(p.length,26);assert.equal(p[0].player_id,1);assert.equal(p[0].club_id,24);assert.equal(p[1].player_id,null);
  assert.equal(p[11].participation,'bench');assert.equal(p[11].minutes_played,null);assert.equal(p[0].goals,null);
});
test('starting XI rejects duplicates, incomplete lists, duplicate grids and invalid formation',()=>{
  for(const change of [d=>d.lineups[0].startXI.pop(),d=>d.lineups[0].startXI[1]=d.lineups[0].startXI[0],d=>d.lineups[0].startXI[1].player.grid='1:1']){
    const d=data();change(d);rejected(()=>normalizeMatchLineup(d),'provider_invalid_lineups');
  }
  const d=data();d.lineups[0].formation='4-4-4';rejected(()=>normalizeMatchLineup(d),'provider_invalid_formation');
});
test('only entered substitutes are confirmed, including a 90+4 appearance rounded to zero minutes',()=>{
  const d=data();d.events=[{team:{id:541},type:'subst',detail:null,time:{elapsed:90,extra:4},player:{id:54110},assist:{id:54120}}];
  const p=normalizeMatchLineup(d).players;
  assert.equal(p.find(p=>p.provider_player_id===54120).participation,'substitute');
  assert.equal(p.find(p=>p.provider_player_id===54120).entered_extra,4);
  assert.equal(p.find(p=>p.provider_player_id===54121).participation,'bench');
  assert.equal(p.find(p=>p.provider_player_id===54110).left_extra,4);
});
test('statistics confirm minutes without inventing an entrance time and override event totals once',()=>{
  const d=data();d.events=[{team:{id:541},type:'Goal',detail:'Normal Goal',time:{elapsed:15,extra:null},player:{id:54100},assist:{id:54101}}];
  d.statistics=[{team:{id:541},players:[{player:{id:54100},statistics:[{games:{minutes:90},goals:{total:1,assists:0},cards:{yellow:0,red:0}}]},{player:{id:54120},statistics:[{games:{minutes:10},goals:{total:0,assists:0},cards:{yellow:1,red:0}}]}]},{team:{id:50},players:[]}];
  const p=normalizeMatchLineup(d).players;
  assert.equal(p[0].goals,1);assert.equal(p[1].assists,1);assert.equal(p[11].participation,'substitute');assert.equal(p[11].entered_minute,null);assert.equal(p[11].minutes_played,10);
});
test('own goals and missed penalties are separate from goals, and a sending-off keeps added time',()=>{
  const d=data();d.events=[{team:{id:50},type:'Goal',detail:'Own Goal',time:{elapsed:45,extra:2},player:{id:54100}},{team:{id:541},type:'Goal',detail:'Missed Penalty',time:{elapsed:70},player:{id:54101}},{team:{id:541},type:'Card',detail:'Red Card',time:{elapsed:90,extra:3},player:{id:54102}}];
  const p=normalizeMatchLineup(d).players;
  assert.equal(p[0].goals,0);assert.equal(p[0].own_goals,1);assert.equal(p[1].missed_penalties,1);assert.equal(p[2].left_extra,3);
});
test('conflicting player identities and unknown event players fail closed',()=>{
  const d=data();d.mappings.push({external_id:54101,player_id:1});rejected(()=>normalizeMatchLineup(d),'provider_player_mapping_conflict');
  const e=data();e.events=[{team:{id:541},type:'Goal',detail:'Normal Goal',time:{elapsed:10},player:{id:9999}}];rejected(()=>normalizeMatchLineup(e),'provider_event_player_unknown');
});
test('prepare is bounded to one date and three fixture endpoints, with no current-squad fallback',async()=>{
  const d=data(),calls=[];
  const client={collection:async(path,params,limits)=>{calls.push({path,params,limits});return {items:path==='/fixtures'?[d.fixture]:path==='/fixtures/lineups'?d.lineups:[],quota:{dailyRemaining:90}};}};
  const r=await prepareMatchLineup(client,d.match,[{club_id:24,external_id:541},{club_id:31,external_id:50}],d.mappings);
  assert.deepEqual(calls.map(c=>c.path),['/fixtures','/fixtures/lineups','/fixtures/events','/fixtures/players']);
  assert.equal(calls[0].params.date,'2024-03-05');assert.equal(r.payload.fixture_id,123);assert.equal(r.payload.events_available,false);
});
