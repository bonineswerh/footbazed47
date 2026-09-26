'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const domain=require('../js/domain.js');

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
