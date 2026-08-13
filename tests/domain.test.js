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
  assert.equal(domain.ratingTone(9),'high');
  assert.equal(domain.ratingTone(9.9),'high');
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
