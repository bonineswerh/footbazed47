'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
test('type generation normalizes only transport metadata and formatting, preserving schema fields',async()=>{
  const {normalizeDatabaseTypes}=await import('../scripts/normalize-database-types.mjs');
  const schema='  public: { Tables: { club_provider_ids: { Row: { club_id: number } } } }\n';
  const metadata="  // Allows to automatically instantiate createClient with right options\n  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)\n  __InternalSupabase: {\n    PostgrestVersion: \"14.5\"\n  }\n";
  assert.equal(normalizeDatabaseTypes(metadata+schema),normalizeDatabaseTypes(schema));
  assert.match(normalizeDatabaseTypes(metadata+schema),/club_provider_ids.*club_id: number/);
  assert.equal(normalizeDatabaseTypes('  TableName extends (A\n    ? B\n    : never) = never,'),normalizeDatabaseTypes('  TableName extends A\n    ? B\n    : never = never,'));
  assert.notEqual(normalizeDatabaseTypes(schema),normalizeDatabaseTypes(schema.replace('club_id','wrong_id')));
});
