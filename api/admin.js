// Protected Vercel function for FOOTBAZED administration.
// Required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and FOOTBALL_DATA_API_KEY (or FOOTBALL_API_KEY) for football-data.org sync.

const https = require('https');
const {createApiFootballClient} = require('../server/football/api-football');
const {prepareClubEmblems,prepareMissingClubEmblem} = require('../server/football/club-emblems');
const {prepareMatchLineup} = require('../server/football/match-lineups');

const LEAGUES = Object.freeze({
  PL: 'Premier League',
  PD: 'La Liga',
  BL1: 'Bundesliga',
  SA: 'Serie A',
  FL1: 'Ligue 1',
  CL: 'Champions League'
});
const MATCH_STATUSES = new Set(['scheduled', 'live', 'finished', 'postponed', 'cancelled']);
const MAX_BODY_BYTES = 32 * 1024;
const MAX_UPSTREAM_BYTES = 4 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const LEGACY_AVATAR_BATCH = 10;

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        raw += chunk;
        if (Buffer.byteLength(raw) > MAX_UPSTREAM_BYTES) {
          req.destroy(new Error('Upstream response is too large'));
        }
      });
      response.on('end', () => resolve({
        status: response.statusCode || 500,
        headers: response.headers,
        raw
      }));
    });
    req.setTimeout(15_000, () => req.destroy(new Error('Upstream request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseJson(raw, fallback = null) {
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

function readBody(req) {
  function decode(value) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (Buffer.byteLength(raw || '') > MAX_BODY_BYTES) throw Object.assign(new Error('body_too_large'), {status:413});
    const body = typeof value === 'string' ? parseJson(raw) : value;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('invalid_body'), {status:400});
    return body;
  }
  if (req.body !== undefined) return Promise.resolve().then(() => decode(req.body));
  return new Promise((resolve, reject) => {
    let raw = '', bytes = 0, tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      if (tooLarge) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) {tooLarge = true; raw = ''; reject(Object.assign(new Error('body_too_large'), {status:413})); return;}
      raw += chunk;
    });
    req.on('end', () => {try {resolve(decode(raw || '{}'));} catch (error) {reject(error);}});
    req.on('error', reject);
  });
}

function envReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function supabase(path, { method = 'GET', body, headers = {} } = {}) {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const response = await request(`${process.env.SUPABASE_URL}${path}`, {
    method,
    headers: serviceHeaders({
      ...(serialized ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(serialized) } : {}),
      ...headers
    })
  }, serialized);
  if (response.status < 200 || response.status >= 300) {
    const details = parseJson(response.raw, {});
    const error = new Error(details.message || details.error_description || 'Database request failed');
    error.status = response.status;
    throw error;
  }
  return response;
}

async function requireAdministrator(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const authResponse = await request(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: authorization
    }
  });
  if (authResponse.status !== 200) return null;
  const user = parseJson(authResponse.raw, {});
  if (!user.id) return null;

  const profileResponse = await supabase(
    `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=id,is_admin`
  );
  const profile = parseJson(profileResponse.raw, [])[0];
  return profile?.is_admin === true ? user : null;
}

function exactCount(response) {
  const range = String(response.headers['content-range'] || '');
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function tableCount(table, filter = '') {
  const response = await supabase(`/rest/v1/${table}?select=id${filter}&limit=1`, {
    headers: { Prefer: 'count=exact' }
  });
  return exactCount(response);
}

async function getOverview() {
  const now = new Date().toISOString();
  const [matches, players, ratings, users, predictions, upcoming, legacyAvatars, recentResponse, missingEmblems] = await Promise.all([
    tableCount('matches'),
    tableCount('players'),
    tableCount('ratings'),
    tableCount('users'),
    tableCount('predictions'),
    tableCount('matches', `&match_date=gte.${encodeURIComponent(now)}&status=in.(scheduled,live)`),
    tableCount('users', '&avatar_url=like.data:image/*'),
    supabase('/rest/v1/matches?select=id,league_name,league_code,home_team_name,away_team_name,match_date,status,home_score,away_score,external_id&order=match_date.desc&limit=120'),
    supabase('/rest/v1/clubs?logo_asset_id=is.null&select=id,name,area_name&order=name&limit=500')
  ]);

  return {
    counts: { matches, players, ratings, users, predictions, upcoming, legacyAvatars },
    recentMatches: parseJson(recentResponse.raw, []),
    missingEmblemClubs: parseJson(missingEmblems.raw, []),
    footballApiConfigured: Boolean(process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY),
    apiFootballConfigured: Boolean(process.env.API_FOOTBALL_KEY),
    checkedAt: new Date().toISOString()
  };
}

async function cleanupDevelopmentData(body) {
  const scope = String(body.scope || '').toLowerCase();
  const confirmation = String(body.confirmation || '');
  if (!['matches', 'players', 'ratings', 'all'].includes(scope)) {
    const error = new Error('Unsupported cleanup scope');
    error.status = 400;
    throw error;
  }
  if (confirmation !== 'DELETE FOOTBAZED DATA') {
    const error = new Error('Confirmation phrase is invalid');
    error.status = 400;
    throw error;
  }
  if (scope === 'all' && !validBatch(body.batch)) throw Object.assign(new Error('prepared_catalog_required'), {status:400});
  const response = await supabase(scope === 'all' ? '/rest/v1/rpc/admin_apply_prepared_catalog' : '/rest/v1/rpc/admin_cleanup_development_data', {
    method: 'POST',
    body: scope === 'all' ? {p_batch:body.batch,p_confirmation:confirmation} : {p_scope: scope, p_confirmation: confirmation}
  });
  return parseJson(response.raw, {});
}

function requireLeague(value) {
  const code = String(value || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(LEAGUES, code)) {
    const error = new Error('Unsupported league');
    error.status = 400;
    throw error;
  }
  return code;
}

function requireDate(value, label) {
  const date = String(value || '');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) {
    const error = new Error(`${label} must use YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return date;
}

async function football(path) {
  const key = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY;
  if (!key) {
    const error = new Error('Football API is not configured');
    error.status = 503;
    throw error;
  }
  const response = await request(`https://api.football-data.org/v4${path}`, {
    headers: { 'X-Auth-Token': key, Accept: 'application/json' }
  });
  const payload = parseJson(response.raw, {});
  if (response.status < 200 || response.status >= 300) {
    const error = new Error(payload.message || 'Football data service rejected the request');
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return payload;
}

function mapStatus(status) {
  return {
    SCHEDULED: 'scheduled', TIMED: 'scheduled',
    IN_PLAY: 'live', PAUSED: 'live', LIVE: 'live',
    FINISHED: 'finished', AWARDED: 'finished',
    POSTPONED: 'postponed', SUSPENDED: 'postponed',
    CANCELLED: 'cancelled'
  }[status] || 'scheduled';
}

function mapPosition(position) {
  return {
    Goalkeeper: 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB', Defence: 'CB',
    'Defensive Midfield': 'DM', 'Central Midfield': 'CM', 'Attacking Midfield': 'AM',
    'Left Midfield': 'LM', 'Right Midfield': 'RM', Midfield: 'CM',
    'Left Winger': 'LW', 'Right Winger': 'RW', 'Centre-Forward': 'ST', Offence: 'ST'
  }[position] || position || null;
}

async function recordAdminAction(actorId, action, {targetType = null, targetId = null, metadata = {}} = {}) {
  try {
    await supabase('/rest/v1/admin_audit_logs', {
      method: 'POST',
      body: {
        actor_id: actorId,
        action,
        target_type: targetType,
        target_id: targetId == null ? null : String(targetId).slice(0, 160),
        metadata
      },
      headers: { Prefer: 'return=minimal' }
    });
  } catch (error) {
    console.error('Admin audit write failed:', error.message);
  }
}

function avatarData(value) {
  const match = String(value || '').match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/iu);
  if (!match) return null;
  const extension = match[1].toLowerCase().replace('jpeg', 'jpg');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) return null;
  return {
    buffer,
    extension,
    contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`
  };
}

async function migrateLegacyAvatars() {
  const params = new URLSearchParams({
    select: 'id,avatar_url',
    avatar_url: 'like.data:image/*',
    limit: String(LEGACY_AVATAR_BATCH)
  });
  const response = await supabase(`/rest/v1/users?${params.toString()}`);
  const profiles = parseJson(response.raw, []);
  let migrated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(profile.id || ''))) {
      skipped += 1;
      continue;
    }
    const image = avatarData(profile.avatar_url);
    if (!image) {
      skipped += 1;
      continue;
    }

    const objectName = `${profile.id}/legacy-avatar.${image.extension}`;
    const upload = await request(`${process.env.SUPABASE_URL}/storage/v1/object/avatars/${objectName}`, {
      method: 'POST',
      headers: serviceHeaders({
        'Content-Type': image.contentType,
        'Content-Length': image.buffer.length,
        'x-upsert': 'true'
      })
    }, image.buffer);
    if (upload.status < 200 || upload.status >= 300) {
      const error = new Error('Avatar storage migration failed');
      error.status = 502;
      throw error;
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/avatars/${objectName}`;
    await supabase(`/rest/v1/users?id=eq.${encodeURIComponent(profile.id)}`, {
      method: 'PATCH',
      body: {avatar_url: publicUrl},
      headers: {Prefer: 'return=minimal'}
    });
    migrated += 1;
  }

  const remaining = await tableCount('users', '&avatar_url=like.data:image/*');
  return {migrated, skipped, remaining};
}

function clubPayload(team) {
  if (!team?.id || !team?.name) return null;
  const founded = Number.isInteger(team.founded) && team.founded >= 1800 && team.founded <= 2100
    ? team.founded
    : undefined;
  return Object.fromEntries(Object.entries({
    external_id: team.id,
    name: team.name,
    short_name: team.shortName || undefined,
    tla: team.tla || undefined,
    area_name: team.area?.name || undefined,
    venue: team.venue || undefined,
    founded,
    club_colors: team.clubColors || undefined,
    updated_at: new Date().toISOString()
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function validBatch(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

async function prepareCatalog(input) {
  const league=requireLeague(input.league),from=requireDate(input.dateFrom,'dateFrom'),to=requireDate(input.dateTo,'dateTo');
  if (!validBatch(input.batch) || to<from || Date.parse(to)-Date.parse(from)>62*86400000) throw Object.assign(new Error('invalid_catalog_request'),{status:400});
  const schedule=await football(`/competitions/${league}/matches?dateFrom=${from}&dateTo=${to}`);
  const squads=await football(`/competitions/${league}/teams`);
  const validTeam=t=>Number.isSafeInteger(t?.id)&&t.id>0&&typeof t.name==='string'&&t.name.trim().length>0;
  const validScore=n=>n==null||Number.isInteger(n)&&n>=0&&n<=99;
  if (!Array.isArray(schedule.matches)||!schedule.matches.length||schedule.matches.length>2000||
      !Array.isArray(squads.teams)||squads.teams.length<2||squads.teams.length>100||
      squads.teams.some(t=>!validTeam(t)||!Array.isArray(t.squad)||t.squad.some(p=>typeof p.name!=='string'||!p.name.trim()))||
      schedule.matches.some(m=>!Number.isSafeInteger(m?.id)||m.id<=0||!validTeam(m.homeTeam)||!validTeam(m.awayTeam)||m.homeTeam.id===m.awayTeam.id||
        typeof m.utcDate!=='string'||Number.isNaN(Date.parse(m.utcDate))||!validScore(m.score?.fullTime?.home)||!validScore(m.score?.fullTime?.away))) {
    throw Object.assign(new Error('invalid_catalog_response'),{status:502});
  }
  const clubs=new Map(squads.teams.map(t=>[t.id,clubPayload(t)]));
  for(const m of schedule.matches)for(const t of [m.homeTeam,m.awayTeam])if(!clubs.has(t.id))clubs.set(t.id,clubPayload(t));
  const players=new Map();
  for(const t of squads.teams)for(const p of t.squad)players.set(JSON.stringify([p.name.trim(),t.id]),{
    name:p.name.trim(),external_club_id:t.id,position:mapPosition(p.position),shirt_number:Number.isInteger(p.shirtNumber)?p.shirtNumber:null,
    metadata:Number.isSafeInteger(p.id)&&p.id>0?{external_id:p.id,provider:'football-data.org'}:{provider:'football-data.org'}
  });
  if(!players.size||players.size>6000)throw Object.assign(new Error('empty_squads'),{status:502});
  const matches=[...new Map(schedule.matches.map(m=>[m.id,{
    external_id:m.id,home_external_id:m.homeTeam.id,away_external_id:m.awayTeam.id,match_date:m.utcDate,status:mapStatus(m.status),
    home_score:m.score?.fullTime?.home??null,away_score:m.score?.fullTime?.away??null,matchday:Number.isInteger(m.matchday)?m.matchday:null,
    season:m.season?.startDate?String(m.season.startDate).slice(0,4):null
  }])).values()];
  const competition=schedule.competition||squads.competition||{};
  const payload={from,to,competition:{external_id:Number.isSafeInteger(competition.id)?competition.id:null,code:league,name:LEAGUES[league],area_name:squads.area?.name||null,competition_type:league==='CL'?'CUP':'LEAGUE'},clubs:[...clubs.values()],players:[...players.values()],matches};
  const response=await supabase('/rest/v1/rpc/admin_stage_catalog',{method:'POST',body:{p_batch:input.batch,p_league:league,p_payload:payload}});
  return parseJson(response.raw,{});
}

async function upsertClubs(teams) {
  const unique = new Map();
  for (const team of teams || []) {
    const row = clubPayload(team);
    if (row) unique.set(row.external_id, row);
  }
  const rows = [...unique.values()];
  if (!rows.length) return new Map();
  const response = await supabase('/rest/v1/clubs?on_conflict=external_id&select=id,external_id', {
    method: 'POST',
    body: rows,
    headers: { Prefer: 'resolution=merge-duplicates,missing=default,return=representation' }
  });
  return new Map(parseJson(response.raw, []).map(club => [Number(club.external_id), Number(club.id)]));
}

async function syncMatches(input) {
  const league = requireLeague(input.league);
  const dateFrom = requireDate(input.dateFrom, 'dateFrom');
  const dateTo = requireDate(input.dateTo, 'dateTo');
  const start = Date.parse(`${dateFrom}T00:00:00Z`);
  const end = Date.parse(`${dateTo}T00:00:00Z`);
  if (end < start || end - start > 62 * 24 * 60 * 60 * 1000) {
    const error = new Error('Choose a date range of 62 days or less');
    error.status = 400;
    throw error;
  }

  const payload = await football(`/competitions/${league}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  if (!Array.isArray(payload.matches)) throw Object.assign(new Error('invalid_matches_response'), {status:502});
  const unique = new Map();
  for (const match of payload.matches) {
    if (!Number.isSafeInteger(match?.id) || match.id <= 0 ||
        !Number.isSafeInteger(match.homeTeam?.id) || match.homeTeam.id <= 0 || !Number.isSafeInteger(match.awayTeam?.id) || match.awayTeam.id <= 0 ||
        typeof match.homeTeam?.name !== 'string' || !match.homeTeam.name.trim() ||
        typeof match.awayTeam?.name !== 'string' || !match.awayTeam.name.trim() ||
        typeof match.utcDate !== 'string' || Number.isNaN(Date.parse(match.utcDate))) {
      throw Object.assign(new Error('invalid_match_response'), {status:502});
    }
    unique.set(match.id, match);
  }
  const matches = [...unique.values()];
  const clubIds = await upsertClubs(matches.flatMap(match => [match.homeTeam, match.awayTeam]));
  const rows = matches.map(match => ({
    external_id: match.id,
    league_code: league,
    league_name: LEAGUES[league],
    home_team_name: match.homeTeam.name,
    away_team_name: match.awayTeam.name,
    home_club_id: clubIds.get(Number(match.homeTeam.id)) || null,
    away_club_id: clubIds.get(Number(match.awayTeam.id)) || null,
    match_date: match.utcDate,
    status: mapStatus(match.status),
    home_score: match.score?.fullTime?.home ?? null,
    away_score: match.score?.fullTime?.away ?? null,
    matchday: match.matchday ?? null,
    season: payload.competition?.code && match.season?.startDate
      ? String(new Date(match.season.startDate).getUTCFullYear())
      : null
  }));

  if (rows.length) {
    await supabase('/rest/v1/matches?on_conflict=external_id', {
      method: 'POST',
      body: rows,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }
  return { league, leagueName: LEAGUES[league], processed: rows.length };
}

async function syncSquads(input) {
  const league = requireLeague(input.league);
  const payload = await football(`/competitions/${league}/teams`);
  if (!Array.isArray(payload.teams) || payload.teams.some(team => !Number.isSafeInteger(team?.id) || team.id <= 0 ||
      typeof team.name !== 'string' || !team.name.trim() || !Array.isArray(team.squad) ||
      team.squad.some(player => typeof player?.name !== 'string' || !player.name.trim()))) {
    throw Object.assign(new Error('invalid_squads_response'), {status:502});
  }
  const clubIds = await upsertClubs(payload.teams);
  const unique = new Map();
  for (const team of payload.teams) {
    for (const player of team.squad) {
      const name = player.name.trim();
      unique.set(JSON.stringify([name, team.name]), {
        name,
        team: team.name,
        club_id: clubIds.get(Number(team.id)) || null,
        position: mapPosition(player.position),
        shirt_number: Number.isInteger(player.shirtNumber) ? player.shirtNumber : null
      });
    }
  }
  const rows = [...unique.values()];
  if (rows.length) {
    await supabase('/rest/v1/players?on_conflict=name,team', {
      method: 'POST',
      body: rows,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }
  return {
    league,
    leagueName: LEAGUES[league],
    teams: (payload.teams || []).length,
    processed: rows.length
  };
}

async function updateMatch(input) {
  const id = Number(input.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error('Invalid match id');
    error.status = 400;
    throw error;
  }
  const status = String(input.status || '');
  if (!MATCH_STATUSES.has(status)) {
    const error = new Error('Invalid match status');
    error.status = 400;
    throw error;
  }
  const homeScore = input.homeScore === '' || input.homeScore == null ? null : Number(input.homeScore);
  const awayScore = input.awayScore === '' || input.awayScore == null ? null : Number(input.awayScore);
  if ([input.homeScore,input.awayScore].some(score => score != null && !['string','number'].includes(typeof score)) ||
      [homeScore, awayScore].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) {
    const error = new Error('Scores must be whole numbers from 0 to 99');
    error.status = 400;
    throw error;
  }
  const matchDate = new Date(input.matchDate);
  if (typeof input.matchDate !== 'string' || !input.matchDate.trim() || Number.isNaN(matchDate.getTime())) {
    const error = new Error('Invalid match date');
    error.status = 400;
    throw error;
  }

  const response = await supabase(`/rest/v1/matches?id=eq.${id}`, {
    method: 'PATCH',
    body: {
      status,
      home_score: homeScore,
      away_score: awayScore,
      match_date: matchDate.toISOString()
    },
    headers: { Prefer: 'return=representation' }
  });
  const match = parseJson(response.raw, [])[0];
  if (!match) {
    const error = new Error('Match not found');
    error.status = 404;
    throw error;
  }
  return match;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'Method not allowed' });
  if (!envReady()) return sendJson(res, 503, { error: 'Server environment is not configured' });

  try {
    const administrator = await requireAdministrator(req.headers.authorization);
    if (!administrator) return sendJson(res, 403, { error: 'Administrator access required' });

    if (req.method === 'GET') {
      const action = String(req.query?.action || 'overview');
      if (action !== 'overview') return sendJson(res, 400, { error: 'Unsupported action' });
      return sendJson(res, 200, await getOverview());
    }

    const body = await readBody(req);
    const action = String(body.action || '');
    if (action === 'moderation_queue') {
      const status = body.status ?? 'open', targetType = body.target_type ?? 'all', offset = body.offset ?? 0;
      if (!['all','open','reviewed','dismissed'].includes(status) || !['all','rating','comment','profile'].includes(targetType) ||
          !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return sendJson(res,400,{error:'invalid_report_filters'});
      const response = await supabase('/rest/v1/rpc/admin_get_community_reports', {method:'POST',body:{
        p_actor:administrator.id,p_status:status,p_target_type:targetType,p_offset:offset,p_limit:20
      }});
      return sendJson(res,200,parseJson(response.raw,{}));
    }
    if (action === 'review_community_report') {
      if (!validBatch(body.report_id) || !['reviewed','dismissed'].includes(body.status) || typeof body.note !== 'string' ||
          body.note.trim().length < 10 || body.note.trim().length > 1000) return sendJson(res,400,{error:'invalid_report_decision'});
      const response = await supabase('/rest/v1/rpc/admin_review_community_report', {method:'POST',body:{
        p_actor:administrator.id,p_report_id:body.report_id,p_status:body.status,p_note:body.note.trim()
      }});
      return sendJson(res,200,parseJson(response.raw,{}));
    }
    if (action === 'api_football_status') {
      return sendJson(res,200,await createApiFootballClient({requestBudget:1}).accountStatus());
    }
    if (action === 'api_football_competition') {
      return sendJson(res,200,await createApiFootballClient({requestBudget:1}).competitionStatus(body.league,body.season));
    }
    if (action === 'prepare_missing_club_emblem') {
      if(!Number.isSafeInteger(body.club_id)||body.club_id<1)return sendJson(res,400,{error:'invalid_club_id'});
      const [clubResponse,mappingsResponse]=await Promise.all([
        supabase(`/rest/v1/clubs?id=eq.${body.club_id}&logo_asset_id=is.null&select=id,name,short_name,external_id,area_name,founded,logo_asset_id&limit=1`),
        supabase('/rest/v1/club_provider_ids?provider=eq.api-football&select=club_id,external_id&limit=500')
      ]);
      const club=parseJson(clubResponse.raw,[])[0];
      if(!club)return sendJson(res,404,{error:'missing_emblem_club_not_found'});
      const prepared=await prepareMissingClubEmblem(createApiFootballClient({requestBudget:1}),club,parseJson(mappingsResponse.raw,[]));
      if(!prepared.items.length)return sendJson(res,200,{...prepared,batch:null,matched:0});
      const staged=await supabase('/rest/v1/rpc/admin_stage_club_emblems',{method:'POST',body:{p_items:prepared.items,p_league:'CATALOG',p_season:null,p_actor:administrator.id}});
      return sendJson(res,200,{...prepared,...parseJson(staged.raw,{})});
    }
    if (action === 'prepare_club_emblems') {
      const league=requireLeague(body.league);
      const [clubsResponse,mappingsResponse]=await Promise.all([
        supabase('/rest/v1/clubs?select=id,name,short_name,external_id,area_name&limit=500'),
        supabase('/rest/v1/club_provider_ids?provider=eq.api-football&select=club_id,external_id&limit=500')
      ]);
      const prepared=await prepareClubEmblems(createApiFootballClient({requestBudget:1}),league,body.season,parseJson(clubsResponse.raw,[]),parseJson(mappingsResponse.raw,[]));
      if (!prepared.items.length) return sendJson(res,200,{...prepared,batch:null,matched:0});
      const staged=await supabase('/rest/v1/rpc/admin_stage_club_emblems',{method:'POST',body:{p_items:prepared.items,p_league:league,p_season:body.season,p_actor:administrator.id}});
      return sendJson(res,200,{...prepared,...parseJson(staged.raw,{})});
    }
    if (action === 'prepare_match_lineup') {
      if (!Number.isSafeInteger(body.match_id)||body.match_id<1) return sendJson(res,400,{error:'invalid_match_id'});
      const response=await supabase(`/rest/v1/matches?id=eq.${body.match_id}&select=id,status,league_code,season,match_date,home_club_id,away_club_id,api_fixture_id&limit=1`);
      const match=parseJson(response.raw,[])[0];
      if (!match) return sendJson(res,404,{error:'match_not_found'});
      if (match.status!=='finished') return sendJson(res,400,{error:'match_not_finished'});
      const clubIds=[Number(match.home_club_id),Number(match.away_club_id)];
      if (clubIds.some(id=>!Number.isSafeInteger(id)||id<1)) return sendJson(res,400,{error:'fixture_identity_unavailable'});
      const clubs=await supabase(`/rest/v1/club_provider_ids?provider=eq.api-football&club_id=in.(${clubIds.join(',')})&select=club_id,external_id&limit=2`);
      const prepared=await prepareMatchLineup(createApiFootballClient({requestBudget:4}),match,parseJson(clubs.raw,[]),async ids=>{
        if(ids.length>60||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw new Error('invalid_provider_player_ids');
        const mapped=await supabase(`/rest/v1/player_provider_ids?provider=eq.api-football&external_id=in.(${ids.join(',')})&select=player_id,external_id&limit=60`);
        return parseJson(mapped.raw,[]);
      });
      const staged=await supabase('/rest/v1/rpc/admin_stage_match_lineup',{method:'POST',body:{p_match_id:match.id,p_payload:prepared.payload,p_actor:administrator.id}});
      return sendJson(res,200,{...parseJson(staged.raw,{}),preview:prepared.payload,quota:prepared.quota});
    }
    if (action === 'apply_match_lineup') {
      if (!validBatch(body.batch)) return sendJson(res,400,{error:'invalid_lineup_batch'});
      const response=await supabase('/rest/v1/rpc/admin_apply_match_lineup',{method:'POST',body:{p_batch:body.batch,p_actor:administrator.id}});
      return sendJson(res,200,parseJson(response.raw,{}));
    }
    if (action === 'apply_club_emblems' || action === 'rollback_club_emblems') {
      if (!validBatch(body.batch)) return sendJson(res,400,{error:'Invalid emblem batch'});
      const response=await supabase(`/rest/v1/rpc/admin_${action}`,{method:'POST',body:{p_batch:body.batch,p_actor:administrator.id}});
      return sendJson(res,200,parseJson(response.raw,{}));
    }
    if (action === 'prepare_catalog') {
      const result=await prepareCatalog(body);
      await recordAdminAction(administrator.id,action,{targetType:'league',targetId:result.league,metadata:{batch:result.batch,matches:result.matches,players:result.players}});
      return sendJson(res,200,result);
    }
    if (action === 'sync_matches') {
      const result = await syncMatches(body);
      await recordAdminAction(administrator.id, action, {targetType:'league', targetId:result.league, metadata:{processed:result.processed}});
      return sendJson(res, 200, result);
    }
    if (action === 'sync_squads') {
      const result = await syncSquads(body);
      await recordAdminAction(administrator.id, action, {targetType:'league', targetId:result.league, metadata:{processed:result.processed,teams:result.teams}});
      return sendJson(res, 200, result);
    }
    if (action === 'update_match') {
      const match = await updateMatch(body);
      await recordAdminAction(administrator.id, action, {targetType:'match', targetId:match.id, metadata:{status:match.status}});
      return sendJson(res, 200, {match});
    }
    if (action === 'migrate_legacy_avatars') {
      const result = await migrateLegacyAvatars();
      await recordAdminAction(administrator.id, action, {targetType:'user_avatar', metadata:result});
      return sendJson(res, 200, result);
    }
    if (action === 'cleanup_development_data') {
      const result = await cleanupDevelopmentData(body);
      await recordAdminAction(administrator.id, action, {
        targetType:'development_data', targetId:result.scope,
        metadata:{deleted:result.deleted || {}}
      });
      return sendJson(res, 200, result);
    }
    if (action === 'test_connection') {
      const league = requireLeague(body.league || 'PL');
      const result = await football(`/competitions/${league}`);
      await recordAdminAction(administrator.id, action, {targetType:'league', targetId:league});
      return sendJson(res, 200, { ok: true, competition: result.name || LEAGUES[league] });
    }
    return sendJson(res, 400, { error: 'Unsupported action' });
  } catch (error) {
    console.error('Admin API request failed:', Number(error.status) || 500);
    const status = Number(error.status) || 500;
    const safeStatus = [400, 403, 404, 413, 429, 502, 503].includes(status) ? status : 500;
    const messages = {400:'Invalid administrative request',403:'Administrator access required',404:'Record not found',413:'Request body is too large',429:'Upstream rate limit reached',502:'Football data service is unavailable',503:'Administrative service is not configured',500:'Administrative service is unavailable'};
    const message = messages[safeStatus];
    return sendJson(res, safeStatus, { error: message, ...(error.name==='FootballProviderError'?{code:error.code}: {}) });
  }
};
