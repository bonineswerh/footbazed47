// Protected Vercel function for FOOTBAZED administration.
// Required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and FOOTBALL_DATA_API_KEY (or FOOTBALL_API_KEY) for football-data.org sync.

const https = require('https');

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
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(parseJson(req.body, {}));
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) reject(new Error('Request body is too large'));
    });
    req.on('end', () => resolve(parseJson(raw || '{}', {})));
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
  const [matches, players, ratings, users, predictions, upcoming, legacyAvatars, recentResponse] = await Promise.all([
    tableCount('matches'),
    tableCount('players'),
    tableCount('ratings'),
    tableCount('users'),
    tableCount('predictions'),
    tableCount('matches', `&match_date=gte.${encodeURIComponent(now)}&status=in.(scheduled,live)`),
    tableCount('users', '&avatar_url=like.data:image/*'),
    supabase('/rest/v1/matches?select=id,league_name,league_code,home_team_name,away_team_name,match_date,status,home_score,away_score,external_id&order=match_date.desc&limit=120')
  ]);

  return {
    counts: { matches, players, ratings, users, predictions, upcoming, legacyAvatars },
    recentMatches: parseJson(recentResponse.raw, []),
    footballApiConfigured: Boolean(process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY),
    checkedAt: new Date().toISOString()
  };
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
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
    crest_url: team.crest || undefined,
    area_name: team.area?.name || undefined,
    venue: team.venue || undefined,
    founded,
    club_colors: team.clubColors || undefined,
    updated_at: new Date().toISOString()
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
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
  const matches = (payload.matches || []).filter(match => match.id && match.homeTeam?.name && match.awayTeam?.name);
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
  const clubIds = await upsertClubs(payload.teams || []);
  const rows = [];
  for (const team of payload.teams || []) {
    for (const player of team.squad || []) {
      if (!player.name || !team.name) continue;
      rows.push({
        name: player.name,
        team: team.name,
        club_id: clubIds.get(Number(team.id)) || null,
        position: mapPosition(player.position),
        shirt_number: Number.isInteger(player.shirtNumber) ? player.shirtNumber : null
      });
    }
  }
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
  if ([homeScore, awayScore].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) {
    const error = new Error('Scores must be whole numbers from 0 to 99');
    error.status = 400;
    throw error;
  }
  const matchDate = new Date(input.matchDate);
  if (Number.isNaN(matchDate.getTime())) {
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
      const action = String(req.query.action || 'overview');
      if (action !== 'overview') return sendJson(res, 400, { error: 'Unsupported action' });
      return sendJson(res, 200, await getOverview());
    }

    const body = await readBody(req);
    const action = String(body.action || '');
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
    if (action === 'test_connection') {
      const league = requireLeague(body.league || 'PL');
      const result = await football(`/competitions/${league}`);
      await recordAdminAction(administrator.id, action, {targetType:'league', targetId:league});
      return sendJson(res, 200, { ok: true, competition: result.name || LEAGUES[league] });
    }
    return sendJson(res, 400, { error: 'Unsupported action' });
  } catch (error) {
    console.error('Admin API error:', error);
    const status = Number(error.status) || 500;
    const safeStatus = [400, 403, 404, 429, 502, 503].includes(status) ? status : 500;
    const message = safeStatus === 500 ? 'Administrative service is unavailable' : error.message;
    return sendJson(res, safeStatus, { error: message });
  }
};
