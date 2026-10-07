const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../js/calendar-model.js');

test('calendar rejects rolled-over, malformed and out-of-range dates',()=>{
  for(const day of ['2026-02-29','2026-04-31','2026-00-12','2026-13-01','2026-2-01','0999-01-01','2026-10-07T00:00:00Z',null])assert.equal(model.parse(day),null);
  assert.equal(model.key(model.parse('2024-02-29')),'2024-02-29');
});
test('day navigation crosses leap, month and year boundaries',()=>{
  assert.equal(model.shift('2024-02-28',1),'2024-02-29');
  assert.equal(model.shift('2026-03-01',-1),'2026-02-28');
  assert.equal(model.shift('2026-12-31',1),'2027-01-01');
  assert.equal(model.shift('1000-01-01',-1),null);
  assert.equal(model.shift('9999-12-31',1),null);
});
for(const [zone,day,hours,from] of [
  ['UTC','2026-10-07',24,'2026-10-07T00:00:00.000Z'],
  ['Europe/Moscow','2026-10-07',24,'2026-10-06T21:00:00.000Z'],
  ['America/New_York','2026-03-08',23,'2026-03-08T05:00:00.000Z'],
  ['America/New_York','2026-11-01',25,'2026-11-01T04:00:00.000Z']
])test(`local day bounds preserve ${hours} hours in ${zone} on ${day}`,()=>{
  const original=process.env.TZ;
  try{
    process.env.TZ=zone;
    const range=model.bounds(day);
    assert.equal(range.from,from);
    assert.equal((Date.parse(range.until)-Date.parse(range.from))/3600000,hours);
    assert.equal(model.key(new Date(range.from)),day);
    assert.equal(model.key(new Date(range.until)),model.shift(day,1));
  }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
