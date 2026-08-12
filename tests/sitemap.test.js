const test=require('node:test');
const assert=require('node:assert/strict');
const {buildSitemap,safeSupabaseUrl}=require('../api/sitemap.js');

test('sitemap includes public entity routes and escapes XML',()=>{
  const xml=buildSitemap({
    clubs:[{id:24,updated_at:'2026-08-10T12:00:00Z'}],
    players:[{id:5290,created_at:'2026-08-01T12:00:00Z'}],
    matches:[{id:101}]
  });
  assert.match(xml,/\/club\/24<\/loc>/u);
  assert.match(xml,/\/player\/5290<\/loc>/u);
  assert.match(xml,/\/match\/101<\/loc>/u);
  assert.match(xml,/<lastmod>2026-08-10<\/lastmod>/u);
  assert.doesNotMatch(xml,/undefined|null/u);
});

test('sitemap accepts only hosted Supabase HTTPS origins',()=>{
  assert.equal(safeSupabaseUrl('https://example.supabase.co/path'),'https://example.supabase.co');
  assert.equal(safeSupabaseUrl('http://example.supabase.co'),'');
  assert.equal(safeSupabaseUrl('https://supabase.co.attacker.test'),'');
});
