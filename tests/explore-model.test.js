const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../js/explore-model');
test('filters accept stable positive IDs, zero goals and real calendar dates',()=>{
  assert.deepEqual(model.normalize({club_id:'24',competition_id:'7',from:'2026-02-29',to:'2024-02-29',home_score:'0',min_rating:'9',sort:'votes',query:'  Real   Madrid '},true),{query:'Real Madrid',competition_id:'7',club_id:'24',to:'2024-02-29',min_rating:'9',home_score:'0'});
  assert.deepEqual(model.normalize({club_id:'-1',competition_id:'1;select',min_votes:'0',sort:'unknown',secret:'x'}),{});
});
test('URL round trip preserves unrelated parameters and separates page scopes',()=>{
  const search=model.searchParams('?__e2e=1&di_query=Brighton&ov_club_id=24&ov_extra=x','ov',{competition_id:'8',query:'Real & City'},{kind:'clubs'});
  assert.equal(new URLSearchParams(search).get('__e2e'),'1');
  assert.equal(new URLSearchParams(search).get('di_query'),'Brighton');
  assert.equal(new URLSearchParams(search).has('ov_extra'),false);
  assert.deepEqual(model.locationFilters(search,'ov'),{query:'Real & City',competition_id:'8'});
});
test('clubs depend on historical fixture participation, including multiple tournaments',()=>{
  const clubs=[{id:24,competition_ids:[7,8]},{id:31,competition_ids:[7]},{id:25,competition_ids:[8]}];
  assert.deepEqual(model.clubsForCompetition(clubs,'8').map(c=>c.id),[24,25]);
  assert.deepEqual(model.clubsForCompetition(clubs,'999'),[]);
  assert.equal(model.clubsForCompetition(clubs,'').length,3);
});
test('month groups use complete server summaries rather than the page average',()=>{
  const groups=model.monthGroups([{id:1,match_date:'2026-10-10',match_rating:10},{id:2,match_date:'2026-09-30',match_rating:1}], [{month:'2026-10',matches:37,average:7.6}]);
  assert.equal(groups[0].summary.matches,37);assert.equal(groups[0].summary.average,7.6);assert.equal(groups[1].summary,null);
});
test('participation mode defaults to confirmed and persists explicit full history only in overview',()=>{
  assert.deepEqual(model.normalize({participation:'confirmed'}),{});
  assert.deepEqual(model.normalize({participation:'untrusted'}),{});
  assert.deepEqual(model.normalize({participation:'all'},true),{});
  const search=model.searchParams('?__e2e=1','ov',{participation:'all'},{kind:'players'});
  assert.deepEqual(model.locationFilters(search,'ov'),{participation:'all'});
});
