'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const domain=require('../js/domain.js');

test('only transient read failures can preserve an already authorized result',()=>{
  for(const error of [new TypeError('Failed to fetch'),{code:'',message:'network unavailable'},{code:'PGRST003'},{status:503}])assert.equal(domain.canRetainReadResult(error),true);
  for(const error of [{name:'AbortError'},{code:'42501'},{code:'PGRST301'},{code:'FBZ_PROFILE_UNAVAILABLE'},{status:403},{status:404},{code:'unexpected'},{code:'PGRST003',status:401},null])assert.equal(domain.canRetainReadResult(error),false);
});

test('match presentation distinguishes a real goalless draw from missing scores',()=>{
  const draw=domain.matchScorePresentation({status:'finished',home_score:0,away_score:0});
  assert.equal(draw.hasScore,true);
  assert.equal(draw.home,'0');
  assert.equal(draw.away,'0');
  for(const scores of [[null,null],[2,null],[-1,0],[NaN,1],[1.5,2],['0','0']]){
    const result=domain.matchScorePresentation({status:'live',home_score:scores[0],away_score:scores[1]});
    assert.equal(result.hasScore,false);
    assert.equal(result.home,'—');
    assert.equal(result.away,'—');
    assert.equal(result.label,'Счёт уточняется');
  }
});

test('upcoming, postponed and unknown matches never publish placeholder scores or raw status',()=>{
  for(const status of ['scheduled','postponed','cancelled','__proto__','<script>']){
    const result=domain.matchScorePresentation({status,home_score:0,away_score:0});
    assert.equal(result.hasScore,false);
    assert.equal(result.home,'—');
    assert.notEqual(result.status,status);
  }
  assert.equal(domain.matchScorePresentation().status,'Статус уточняется');
});

test('search groups preserve the strongest category and per-category relevance without mutating results',()=>{
  const items=[{entity_type:'player',entity_id:'1'},{entity_type:'club',entity_id:'2'},{entity_type:'player',entity_id:'3'},{entity_type:'club',entity_id:'4'},{entity_type:'user',entity_id:'5'}];
  const before=structuredClone(items),groups=domain.searchResultGroups(items);
  assert.deepEqual(groups.map(group=>group.kind),['player','club','user']);
  assert.deepEqual(groups.flatMap(group=>group.items).map(item=>item.entity_id),['1','3','2','4','5']);
  assert.deepEqual(items,before);
  assert.deepEqual(domain.searchResultGroups(null),[]);
  assert.deepEqual(domain.searchResultGroups([null,{entity_type:'__proto__'}]),[]);
  assert.deepEqual(domain.searchResultGroups([{entity_type:'team',title:'Legacy'}]).map(group=>group.kind),['club']);
});

test('rating draft requires a supporter side and an integer match score from 1 to 10',()=>{
  assert.equal(domain.validateRatingDraft({matchRating:0,supporterSide:'neutral'}).valid,false);
  assert.equal(domain.validateRatingDraft({matchRating:7.5,supporterSide:'home'}).valid,false);
  assert.equal(domain.validateRatingDraft({matchRating:10}).valid,false);
  assert.equal(domain.validateRatingDraft({matchRating:10,supporterSide:'away'}).valid,true);
});

test('best player must have a player rating',()=>{
  const result=domain.validateRatingDraft({
    matchRating:8,supporterSide:'neutral',
    playerRatings:[{player_id:11,rating:8}],
    bestPlayerId:12
  });
  assert.equal(result.valid,false);
  assert.match(result.error,/лучшему игроку/i);
});

test('rating draft rejects duplicate players and oversized comments',()=>{
  assert.equal(domain.validateRatingDraft({
    matchRating:8,supporterSide:'home',
    playerRatings:[{player_id:11,rating:7},{player_id:11,rating:8}]
  }).valid,false);
  assert.equal(domain.validateRatingDraft({matchRating:8,supporterSide:'away',comment:'x'.repeat(1001)}).valid,false);
});

test('rating tones use restrained semantic ranges',()=>{
  assert.equal(domain.ratingTone(null),'neutral');
  assert.equal(domain.ratingTone(3),'low');
  assert.equal(domain.ratingTone(6),'mid');
  assert.equal(domain.ratingTone(6.9),'mid');
  assert.equal(domain.ratingTone(7),'high');
  assert.equal(domain.ratingTone(9),'elite');
  assert.equal(domain.ratingTone(9.9),'elite');
  assert.equal(domain.ratingTone(10),'elite');
});

test('rating presentation keeps the value visible and tied to the ten-point scale',()=>{
  assert.deepEqual(domain.ratingPresentation(10),{
    score:10,value:'10',label:'10/10',tone:'elite',progress:100
  });
  assert.deepEqual(domain.ratingPresentation(8.5,1),{
    score:8.5,value:'8.5',label:'8.5/10',tone:'high',progress:85
  });
  assert.deepEqual(domain.ratingPresentation(null),{
    score:null,value:'—',label:'Нет оценки',tone:'neutral',progress:0
  });
});

test('auth errors are localized without exposing unknown backend text',()=>{
  assert.equal(domain.authErrorMessage({message:'Invalid login credentials'}),'Неверный email или пароль');
  assert.equal(domain.authErrorMessage({message:'internal database detail'},'Безопасная ошибка'),'Безопасная ошибка');
});

test('search query is normalized and bounded',()=>{
  assert.equal(domain.normalizeSearchQuery('  real   madrid  '),'real madrid');
  assert.equal(domain.normalizeSearchQuery('x'.repeat(100)).length,80);
});

test('matches are ordered by live, upcoming and recent finished',()=>{
  const now=Date.parse('2026-08-09T12:00:00Z');
  const items=[
    {id:1,status:'finished',match_date:'2026-08-01T12:00:00Z'},
    {id:2,status:'scheduled',match_date:'2026-08-10T12:00:00Z'},
    {id:3,status:'live',match_date:'2026-08-09T11:00:00Z'},
    {id:4,status:'scheduled',match_date:'2026-08-08T12:00:00Z'},
    {id:5,status:'finished',match_date:'2026-08-08T12:00:00Z'}
  ];
  assert.deepEqual(domain.sortMatches(items,now).map(item=>item.id),[3,2,4,5,1]);
});


test('diary labels use Russian plurals and neutral factual counts',()=>{
  for(const [count,label] of [[1,'1 матч в дневнике'],[2,'2 матча в дневнике'],[11,'11 матчей в дневнике'],[21,'21 матч в дневнике'],[112,'112 матчей в дневнике']]){
    assert.equal(domain.profileActivity(count).label,label);
  }
  for(const value of [undefined,null,-5,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
    assert.equal(domain.profileActivity(value).count,0);
    assert.equal(domain.profileActivity(value).label,'Дневник болельщика');
  }
  assert.deepEqual(domain.profileActivity({ratings:11,likes:1000,friends:500}),domain.profileActivity(0));
});

test('diary milestones advance at boundaries without awarding expertise',()=>{
  for(const [count,next,remaining,progress] of [[0,1,1,0],[1,10,9,0],[10,25,15,0],[11,25,14,7],[24,25,1,93],[25,50,25,0],[999,1000,1,99],[1000,1500,500,0],[1250,1500,250,50],[1500,2000,500,0]]){
    const activity=domain.profileActivity(count);
    assert.equal(activity.next,next);assert.equal(activity.remaining,remaining);assert.equal(activity.progress,progress);
    assert.equal(Object.isFrozen(activity),true);
  }
});


test('club palettes preserve home/away identity and reject arbitrary CSS',()=>{
  assert.equal(domain.clubColor('  REAL   MADRID CF '),domain.clubColor('Реал Мадрид'));
  assert.notEqual(domain.clubColor('Real Madrid CF'),domain.clubColor('Manchester City FC'));
  assert.equal(domain.clubColor('unknown'),domain.clubColor('url(https://invalid.test)'));
  assert.match(domain.matchPaletteStyle({home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC'}),/^--club-home:#[0-9a-f]{6};--club-away:#[0-9a-f]{6};--club-home-secondary:#[0-9a-f]{6};--club-away-secondary:#[0-9a-f]{6}$/);
  assert.deepEqual(domain.clubPalette('Barça'),domain.clubPalette('FC Barcelona'));
  assert.notEqual(...domain.clubPalette('Barça'));
  assert.notEqual(...domain.clubPalette('Brighton Hove'));
  assert.notDeepEqual(domain.clubPalette('Atleti'),domain.clubPalette('Barça'));
  assert.equal(...domain.clubPalette('PSG'));
  assert.equal(...domain.clubPalette('Real Madrid'));
  assert.equal(domain.ratingTone(8.9),'high');
});
test('compact team names prefer catalog metadata with safe readable fallbacks',()=>{
  assert.equal(domain.matchTeamName({home_team_name:'Real Madrid CF',home_club:{name:'Real Madrid CF',short_name:'Real Madrid'}},'home'),'Real Madrid');
  assert.equal(domain.matchTeamName({away_team_name:'Unknown FC'},'away'),'Unknown FC');
  assert.equal(domain.clubDisplayName({name:'Full Name'}),'Full Name');
});

test('many votes from one author remain preliminary',()=>{
  assert.equal(domain.ratingEvidence({votes:100,voters:1}).preliminary,true);
  assert.equal(domain.ratingEvidence({votes:5,voters:5}).preliminary,false);
  assert.equal(domain.ratingEvidence({votes:4,voters:4}).preliminary,true);
  assert.equal(domain.ratingEvidence({votes:8,voters:5,unverified:2}).unverified,2);
  assert.equal(domain.ratingEvidence({votes:8,voters:5,unverified:2}).preliminary,true);
});
