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
test('manual dates require a real exact day without rollover or partial years',()=>{
  assert.equal(model.exact('01.08.2016'),'2016-08-01');
  assert.equal(model.exact(' 29.02.2024 '),'2024-02-29');
  for(const value of ['31.02.2024','29.02.2026','1.8.2016','01.08.16','2016-08-01','00.01.2026','01.13.2026','01.01.0999',''])assert.equal(model.exact(value),null);
  assert.equal(model.formatted('2016-08-01'),'01.08.2016');
  assert.equal(model.formatted('invalid'),'');
});
test('month navigation begins on the first day and respects the supported range',()=>{
  assert.equal(model.month('2024-03-31',-1),'2024-02-01');
  assert.equal(model.month('2026-12-31',1),'2027-01-01');
  assert.equal(model.month('1000-01-01',-1),null);
  assert.equal(model.month('9999-12-31',1),null);
  assert.equal(model.month('invalid'),null);
});
test('month cells use Monday first, include leap day and never roll past the bounds',()=>{
  const cells=model.monthDays('2024-02-29');assert.equal(cells.length,42);
  assert.equal(cells[0],'2024-01-29');assert.equal(cells[3],'2024-02-01');
  assert.ok(cells.includes('2024-02-29'));assert.equal(cells.at(-1),'2024-03-10');
  assert.ok(model.monthDays('1000-01-01').some(day=>day===null));
  assert.ok(model.monthDays('9999-12-31').some(day=>day===null));
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
