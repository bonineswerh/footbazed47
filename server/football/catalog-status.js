'use strict';

const ACTIONS = new Set(['sync_matches','sync_squads','sync_matches_failed','sync_squads_failed','test_connection','update_match','apply_club_emblems','apply_match_lineup','prepare_catalog','cleanup_development_data','migrate_legacy_avatars','moderation.report_review']);
const LEAGUES = new Set(['PL','PD','BL1','SA','FL1','CL']);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(value)?.slice(0,10) === value ? value : null;

// Deliberately omit actor IDs, moderation notes, snapshots and provider payloads.
function auditItem(row) {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const item = {id:Number(row?.id),action:ACTIONS.has(row?.action)?row.action:'other',at:timestamp(row?.created_at)};
  if (!Number.isSafeInteger(item.id) || item.id < 1 || !item.at) return null;
  item.failed = item.action.endsWith('_failed');
  if (row.target_type === 'league' && LEAGUES.has(row.target_id)) item.league = row.target_id;
  if (Number.isSafeInteger(metadata.processed) && metadata.processed >= 0) item.processed = metadata.processed;
  if (date(metadata.dateFrom) && date(metadata.dateTo)) {
    item.dateFrom = metadata.dateFrom; item.dateTo = metadata.dateTo;
  }
  if ([429,502,503,500].includes(metadata.status)) item.status = metadata.status;
  return item;
}

function auditPage(rows) {
  if (!Array.isArray(rows)) throw new Error('invalid_audit_response');
  const items = rows.slice(0,20).map(auditItem).filter(Boolean);
  return {items,hasMore:rows.length>20,nextCursor:rows.length>20?Number(rows[19]?.id)||null:null};
}

module.exports = {auditItem,auditPage,timestamp};
