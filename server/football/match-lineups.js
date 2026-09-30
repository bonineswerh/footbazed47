'use strict';

const {FootballProviderError,PILOT_COMPETITIONS}=require('./api-football');
const fail=code=>{throw new FootballProviderError(code,502);};
const id=value=>Number.isSafeInteger(value)&&value>0;
const count=(value,max)=>value===null||value===undefined?null:Number.isInteger(value)&&value>=0&&value<=max?value:fail('provider_invalid_player_statistics');
const minute=time=>{
  if(!time||!Number.isInteger(time.elapsed)||time.elapsed<0||time.elapsed>120)fail('provider_invalid_events');
  return {minute:time.elapsed,extra:count(time.extra,30)};
};

function selectFixture(items,match,teams){
  if(!Array.isArray(items)||items.length>100||!match||!Object.hasOwn(PILOT_COMPETITIONS,match.league_code)
    ||!Number.isInteger(Number(match.season))||!Number.isFinite(Date.parse(match.match_date))||!id(teams.home)||!id(teams.away))fail('fixture_identity_unavailable');
  const candidates=items.filter(row=>row?.league?.id===PILOT_COMPETITIONS[match.league_code]
    &&row.league.season===Number(match.season)&&row?.teams?.home?.id===teams.home&&row?.teams?.away?.id===teams.away
    &&Math.abs(Date.parse(row?.fixture?.date)-Date.parse(match.match_date))<=15*60*1000);
  if(candidates.length!==1)fail(candidates.length?'fixture_identity_ambiguous':'fixture_identity_not_found');
  const fixture=candidates[0];
  if(!id(fixture.fixture.id)||fixture.fixture.id>2147483647||!['FT','AET','PEN'].includes(fixture.fixture.status?.short)
    ||(match.api_fixture_id!=null&&Number(match.api_fixture_id)!==fixture.fixture.id))fail('fixture_identity_conflict');
  return fixture;
}

function normalizeMatchLineup({fixture,match,teams,lineups,events=null,statistics=null,mappings=[]}){
  selectFixture([fixture],match,teams);
  if(!Array.isArray(lineups)||lineups.length!==2||!Array.isArray(mappings))fail('provider_lineups_unavailable');
  const players=new Map(),formations={};
  for(const side of ['home','away']){
    const rows=lineups.filter(item=>item?.team?.id===teams[side]);
    if(rows.length!==1)fail('provider_invalid_lineups');
    const row=rows[0],clubId=Number(match[`${side}_club_id`]);
    if(!id(clubId)||!Array.isArray(row.startXI)||row.startXI.length!==11||!Array.isArray(row.substitutes)||row.substitutes.length>19)fail('provider_invalid_lineups');
    const formation=row.formation;
    if(formation!=null&&(typeof formation!=='string'||!/^[1-5](-[1-5]){2,4}$/u.test(formation)||formation.split('-').reduce((sum,n)=>sum+Number(n),0)!==10))fail('provider_invalid_formation');
    formations[`${side}_formation`]=formation||null;
    const grids=new Set();
    for(const [participation,entries] of [['starter',row.startXI],['bench',row.substitutes]]){
      for(const entry of entries){
        const p=entry?.player;
        if(!p||!id(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>160||players.has(p.id)
          ||(p.pos!=null&&!['G','D','M','F'].includes(p.pos))
          ||(p.number!=null&&(!Number.isInteger(p.number)||p.number<1||p.number>99))
          ||(participation==='starter'&&p.grid!=null&&(!/^[1-6]:[1-5]$/u.test(p.grid)||grids.has(p.grid))))fail('provider_invalid_lineups');
        if(participation==='starter'&&p.grid)grids.add(p.grid);
        const mapped=mappings.filter(m=>Number(m.external_id)===p.id);
        if(mapped.length>1||mapped.some(m=>!id(Number(m.player_id))))fail('provider_player_mapping_conflict');
        players.set(p.id,{provider_player_id:p.id,player_id:mapped.length?Number(mapped[0].player_id):null,club_id:clubId,
          name:p.name.trim(),participation,position:p.pos||null,shirt_number:p.number||null,grid:participation==='starter'?p.grid||null:null,
          entered_minute:participation==='starter'?0:null,entered_extra:null,left_minute:null,left_extra:null,minutes_played:null,
          goals:null,assists:null,yellow_cards:null,red_cards:null,own_goals:null,missed_penalties:null});
      }
    }
  }
  if(events!==null){
    if(!Array.isArray(events)||events.length>200)fail('provider_invalid_events');
    for(const p of players.values())for(const field of ['goals','assists','yellow_cards','red_cards','own_goals','missed_penalties'])p[field]=0;
    for(const event of events){
      const side=event?.team?.id===teams.home?'home':event?.team?.id===teams.away?'away':null;
      if(!side||!['Goal','Card','subst','Var'].includes(event.type))fail('provider_invalid_events');
      const t=minute(event.time),p=players.get(event.player?.id),assisting=players.get(event.assist?.id);
      // VAR can refer to an official rather than a player and conveys no appearance.
      if(event.type==='Var')continue;
      // Own-goal events belong to the benefiting team in this provider's timeline.
      if(!p||(event.type==='Goal'&&event.detail==='Own Goal'
        ? ![Number(match.home_club_id),Number(match.away_club_id)].includes(p.club_id)
        : p.club_id!==Number(match[`${side}_club_id`])))fail('provider_event_player_unknown');
      if(event.type==='subst'){
        if(!assisting||assisting.club_id!==p.club_id||assisting.participation!=='bench'||p.participation==='bench'||p.left_minute!==null)fail('provider_invalid_substitution');
        p.left_minute=t.minute;p.left_extra=t.extra;
        assisting.participation='substitute';assisting.entered_minute=t.minute;assisting.entered_extra=t.extra;
      }else if(event.type==='Goal'){
        if(['Normal Goal','Penalty'].includes(event.detail)){
          p.goals++;
          if(event.assist?.id!=null){if(!assisting||assisting.club_id!==p.club_id)fail('provider_event_player_unknown');assisting.assists++;}
        }else if(event.detail==='Own Goal')p.own_goals++;
        else if(event.detail==='Missed Penalty')p.missed_penalties++;
        else fail('provider_invalid_events');
      }else{
        if(event.detail==='Yellow Card')p.yellow_cards++;
        else if(['Red Card','Yellow-Red Card'].includes(event.detail)){
          p.red_cards=1;
          if(event.detail==='Yellow-Red Card')p.yellow_cards=Math.min(2,p.yellow_cards+1);
          if(p.participation!=='bench'&&p.left_minute===null){p.left_minute=t.minute;p.left_extra=t.extra;}
        }else fail('provider_invalid_events');
      }
    }
  }
  if(statistics!==null){
    if(!Array.isArray(statistics)||statistics.length!==2)fail('provider_invalid_player_statistics');
    const seen=new Set(),seenTeams=new Set();
    for(const row of statistics){
      const side=row?.team?.id===teams.home?'home':row?.team?.id===teams.away?'away':null;
      if(!side||seenTeams.has(row.team.id)||!Array.isArray(row.players)||row.players.length>30)fail('provider_invalid_player_statistics');
      seenTeams.add(row.team.id);
      for(const entry of row.players){
        const p=players.get(entry?.player?.id);
        if(!p||p.club_id!==Number(match[`${side}_club_id`])||seen.has(entry.player.id)||!Array.isArray(entry.statistics)||entry.statistics.length!==1)fail('provider_invalid_player_statistics');
        seen.add(entry.player.id);
        const s=entry.statistics[0],minutes=count(s?.games?.minutes,150);
        if(p.participation==='bench'&&minutes>0)p.participation='substitute';
        if(p.participation==='substitute'&&minutes===0&&p.entered_minute===null)fail('provider_invalid_player_statistics');
        p.minutes_played=minutes;
        // Stats override event aggregates, so a goal is never counted twice.
        for(const [field,value,max] of [['goals',s.goals?.total,20],['assists',s.goals?.assists,20],
          ['yellow_cards',s.cards?.yellow,2],['red_cards',s.cards?.red,1],['missed_penalties',s.penalty?.missed,10]]){
          const normalized=count(value,max);if(normalized!==null)p[field]=normalized;
        }
      }
    }
  }
  const usedIds=new Set();
  for(const p of players.values()){
    if(p.player_id!==null){if(usedIds.has(p.player_id))fail('provider_player_mapping_conflict');usedIds.add(p.player_id);}
    // A substitute introduced in stoppage time is confirmed even when rounded minutes are zero.
    if(p.participation==='substitute'&&p.entered_minute===null&&!(p.minutes_played>0))fail('provider_invalid_substitution');
  }
  return {provider:'api-football',fixture_id:fixture.fixture.id,match_date:fixture.fixture.date,
    home_club_id:Number(match.home_club_id),away_club_id:Number(match.away_club_id),league_code:match.league_code,season:Number(match.season),
    ...formations,events_available:events!==null,statistics_available:statistics!==null,players:[...players.values()]};
}

async function prepareMatchLineup(client,match,clubMappings,playerMappings){
  if(!match||match.status!=='finished'||!Object.hasOwn(PILOT_COMPETITIONS,match.league_code))fail('fixture_identity_unavailable');
  const mapping=clubId=>clubMappings.filter(m=>Number(m.club_id)===Number(clubId));
  const home=mapping(match.home_club_id),away=mapping(match.away_club_id);
  if(home.length!==1||away.length!==1)fail('fixture_club_mapping_missing');
  const teams={home:Number(home[0].external_id),away:Number(away[0].external_id)};
  const date=new Date(match.match_date);
  if(!Number.isFinite(date.valueOf()))fail('fixture_identity_unavailable');
  const found=await client.collection('/fixtures',{league:PILOT_COMPETITIONS[match.league_code],season:Number(match.season),date:date.toISOString().slice(0,10)},{maxPages:1,maxItems:100});
  const fixture=selectFixture(found.items,match,teams),fixtureId=fixture.fixture.id;
  const lineups=await client.collection('/fixtures/lineups',{fixture:fixtureId},{maxPages:1,maxItems:2});
  if(!lineups.items.length)fail('provider_lineups_unavailable');
  normalizeMatchLineup({fixture,match,teams,lineups:lineups.items});
  const events=await client.collection('/fixtures/events',{fixture:fixtureId},{maxPages:1,maxItems:200});
  const stats=await client.collection('/fixtures/players',{fixture:fixtureId},{maxPages:1,maxItems:2});
  const mappings=typeof playerMappings==='function'?await playerMappings(lineups.items.flatMap(team=>[...team.startXI,...team.substitutes].map(entry=>entry.player.id))):playerMappings;
  return {payload:normalizeMatchLineup({fixture,match,teams,lineups:lineups.items,
    events:events.items.length?events.items:null,statistics:stats.items.length?stats.items:null,mappings}),quota:stats.quota};
}

module.exports={selectFixture,normalizeMatchLineup,prepareMatchLineup};
