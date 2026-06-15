// host-player-photos.mjs — download EVERY player headshot into our own public
// Supabase Storage bucket (`player-photos/<id>.<ext>`) and repoint
// players.photo_url at it, so photos are permanent + CDN-served instead of
// hotlinked to media.api-sports.io.
//
// Per player, a source image URL is resolved in priority order:
//   1. existing api-sports URL (the 1130 we already have) → just re-host it
//   2. missing + the team has an API-Football squad → match by shirt number
//      (unique within a team) → that squad member's api-sports photo
//   3. still missing (all of DR Congo + single-name players) → Wikidata/Commons:
//      search the name, require occupation = association football player
//      (Q937857), prefer the candidate whose description matches the team's
//      nationality, take P18 → a 256px Commons thumbnail.
// Then the bytes are uploaded as-is (Wikimedia pre-resizes; api-sports headshots
// are already tiny — no image lib needed) with their real content-type.
//
// Resumable: scripts/.host-photos.json checkpoints every hosted player and
// remembers teams with no API-Football squad so re-runs don't burn the quota.
// Idempotent: players already pointing at player-photos are skipped unless
// --refresh is passed. Run: node scripts/host-player-photos.mjs [--refresh]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFRESH = process.argv.includes('--refresh');

// ── env ──────────────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const AF_KEY = env.APIFOOTBALL_KEY;
if (!SB_URL || !SR_KEY) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const BUCKET = 'player-photos';
const PUBLIC_BASE = `${SB_URL}/storage/v1/object/public/${BUCKET}`;
const UA = '11Gol/1.0 (https://portela11.com; info@portela11.com)';

// ── Supabase REST + Storage (service role) ───────────────────────────────────
const sbHeaders = {
  apikey: SR_KEY,
  Authorization: `Bearer ${SR_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};
async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function sbPatch(path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase PATCH ${path}: ${res.status} ${await res.text()}`);
}
async function uploadObject(path, buffer, contentType) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SR_KEY,
      Authorization: `Bearer ${SR_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`storage upload ${path}: ${res.status} ${await res.text()}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── API-Football (paced for the free plan's 10 req/min) ──────────────────────
let afCalls = 0;
async function af(path) {
  await sleep(6500);
  afCalls++;
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': AF_KEY },
  });
  const json = await res.json();
  const errs = json.errors && Object.keys(json.errors).length ? json.errors : null;
  if (errs) throw new Error(`api-football ${path}: ${JSON.stringify(errs)}`);
  return json.response ?? [];
}

// ── Wikidata / Wikimedia Commons ─────────────────────────────────────────────
const FOOTBALLER_Q = 'Q937857'; // association football player
async function wd(params) {
  await sleep(180); // be polite to the Wikimedia API
  const qs = new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(`https://www.wikidata.org/w/api.php?${qs}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`wikidata ${params.action}: ${res.status}`);
  return res.json();
}
async function wbSearch(name) {
  const j = await wd({ action: 'wbsearchentities', search: name, language: 'en', uselang: 'en', type: 'item', limit: '8' });
  return j.search ?? [];
}
/** P18 image filename for an entity, but only if it's a football player. */
async function wbImage(qid) {
  const j = await wd({ action: 'wbgetentities', ids: qid, props: 'claims' });
  const claims = j.entities?.[qid]?.claims ?? {};
  const isFootballer = (claims.P106 ?? []).some(
    (c) => c.mainsnak?.datavalue?.value?.id === FOOTBALLER_Q,
  );
  if (!isFootballer) return null;
  const file = claims.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof file === 'string' ? file : null;
}
function commonsThumb(file) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=256`;
}
/** English Wikipedia full-text search → article → Wikidata item → P18. Catches
 *  mononyms/short names our DB stores ("Martinelli" → "Gabriel Martinelli")
 *  that the bare Wikidata label search can't surface. */
async function enwiki(params) {
  await sleep(180);
  const qs = new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${qs}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`enwiki ${params.action}: ${res.status}`);
  return res.json();
}
async function enwikiPhoto(name, demonym) {
  const s = await enwiki({
    action: 'query', list: 'search', srlimit: '4',
    srsearch: `${name} ${demonym ?? ''} footballer`.trim(),
  });
  for (const hit of s.query?.search ?? []) {
    const pp = await enwiki({ action: 'query', prop: 'pageprops', titles: hit.title });
    const page = Object.values(pp.query?.pages ?? {})[0];
    const qid = page?.pageprops?.wikibase_item;
    if (!qid) continue;
    const file = await wbImage(qid);
    if (file) return commonsThumb(file);
  }
  return null;
}
/** Find a footballer's headshot on Wikidata, ranked by nationality match. */
async function wikidataPhoto(name, demonyms) {
  const cands = await wbSearch(name);
  const ranked = cands
    .map((c) => {
      const d = (c.description ?? '').toLowerCase();
      const isFoot = /(footballer|soccer player|football player|football midfielder|football forward|football defender|goalkeeper)/.test(d);
      const isNat = demonyms.some((dem) => d.includes(dem));
      return { id: c.id, score: (isFoot ? 2 : 0) + (isNat ? 1 : 0), isFoot };
    })
    .sort((a, b) => b.score - a.score);
  // Prefer description-confirmed footballers; fall back to checking claims for
  // the top few (some Wikidata items have empty/odd descriptions).
  const order = ranked.filter((r) => r.isFoot).concat(ranked.filter((r) => !r.isFoot).slice(0, 3));
  for (const r of order.slice(0, 5)) {
    const file = await wbImage(r.id);
    if (file) return commonsThumb(file);
  }
  // Fallback: English Wikipedia full-text (handles mononyms/short DB names).
  return enwikiPhoto(name, demonyms[0]);
}

// Nationality hints per team id (first = primary demonym) for Wikidata ranking.
const DEMONYMS = {
  alg: ['algerian'], arg: ['argentine', 'argentinian'], aus: ['australian'],
  aut: ['austrian'], bel: ['belgian'], bih: ['bosnian', 'herzegovin'],
  bra: ['brazilian'], can: ['canadian'], civ: ['ivorian', 'ivory coast'],
  cod: ['congolese', 'dr congo', 'democratic republic of the congo'],
  col: ['colombian'], cpv: ['cape verdean', 'cape verde', 'cabo verde'],
  cro: ['croatian'], cuw: ['curaçaoan', 'curacao', 'curaçao'], cze: ['czech'],
  ecu: ['ecuadorian'], egy: ['egyptian'], eng: ['english'], esp: ['spanish'],
  fra: ['french'], ger: ['german'], gha: ['ghanaian'], hai: ['haitian'],
  irn: ['iranian'], irq: ['iraqi'], jor: ['jordanian'], jpn: ['japanese'],
  kor: ['south korean', 'korean'], ksa: ['saudi'], mar: ['moroccan'],
  mex: ['mexican'], ned: ['dutch', 'netherlands'], nor: ['norwegian'],
  nzl: ['new zealand'], pan: ['panamanian'], par: ['paraguayan'],
  por: ['portuguese'], qat: ['qatari'], rsa: ['south african'],
  sco: ['scottish', 'scotland'], sen: ['senegalese'], sui: ['swiss'],
  swe: ['swedish'], tun: ['tunisian'], tur: ['turkish'], uru: ['uruguayan'],
  usa: ['american', 'united states'], uzb: ['uzbekistani', 'uzbek'],
};

// ── checkpoint ────────────────────────────────────────────────────────────────
const ckptPath = join(root, 'scripts', '.host-photos.json');
const ckpt = existsSync(ckptPath)
  ? JSON.parse(readFileSync(ckptPath, 'utf8').replace(/^﻿/, ''))
  : { hosted: {}, afNoSquad: [] };
ckpt.hosted ??= {};
ckpt.afNoSquad ??= [];
const save = () => writeFileSync(ckptPath, JSON.stringify(ckpt, null, 2));

// ── image download + host ─────────────────────────────────────────────────────
function extFor(ctype) {
  if (/png/i.test(ctype)) return 'png';
  if (/webp/i.test(ctype)) return 'webp';
  if (/gif/i.test(ctype)) return 'gif';
  return 'jpg';
}
/** Download a source image and upload it to our bucket; returns the public URL. */
async function host(id, srcUrl) {
  const res = await fetch(srcUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const ctype = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
  if (!/^image\//.test(ctype)) throw new Error(`not an image (${ctype})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error(`too small (${buf.length}b)`);
  const ext = extFor(ctype);
  const path = `${id}.${ext}`;
  await uploadObject(path, buf, ctype);
  return `${PUBLIC_BASE}/${path}`;
}

// ── main ──────────────────────────────────────────────────────────────────────
const teams = await sbGet('teams?select=id,name,api_football_id&order=id');
const teamById = new Map(teams.map((t) => [t.id, t]));

const players = [];
for (let from = 0; ; from += 1000) {
  const page = await sbGet(
    `players?select=id,team_id,name,shirt_number,photo_url&order=team_id,id&offset=${from}&limit=1000`,
  );
  players.push(...page);
  if (page.length < 1000) break;
}
console.log(`Players: ${players.length} · already hosted in checkpoint: ${Object.keys(ckpt.hosted).length}`);

// Cache API-Football squads we fetch this run (per team).
const afSquadCache = new Map();
async function getAfSquad(team) {
  if (afSquadCache.has(team.id)) return afSquadCache.get(team.id);
  if (ckpt.afNoSquad.includes(team.id) || !team.api_football_id || !AF_KEY) {
    afSquadCache.set(team.id, []);
    return [];
  }
  let squad = [];
  try {
    const squads = await af(`players/squads?team=${team.api_football_id}`);
    squad = squads[0]?.players ?? [];
    if (!squad.length) {
      ckpt.afNoSquad.push(team.id);
      save();
    }
  } catch (e) {
    console.warn(`  ! api-football squad ${team.id}: ${e.message}`);
  }
  afSquadCache.set(team.id, squad);
  return squad;
}

let hosted = 0;
let viaApi = 0;
let viaAfNum = 0;
let viaWiki = 0;
const missing = [];

for (const p of players) {
  const alreadyOurs = (p.photo_url ?? '').includes(`/${BUCKET}/`);
  if (!REFRESH && (ckpt.hosted[p.id] || alreadyOurs)) continue;

  const team = teamById.get(p.team_id);
  const demonyms = DEMONYMS[p.team_id] ?? [];
  try {
    // 1. resolve a source image URL
    let src = null;
    let via = '';
    if ((p.photo_url ?? '').includes('api-sports')) {
      src = p.photo_url;
      via = 'api';
    } else {
      // 2. API-Football squad, matched by shirt number (unique within a team)
      if (team && p.shirt_number != null) {
        const squad = await getAfSquad(team);
        const byNum = squad.find((s) => Number(s.number) === Number(p.shirt_number) && s.photo);
        if (byNum) {
          src = byNum.photo;
          via = 'afnum';
        }
      }
      // 3. Wikidata / Commons
      if (!src) {
        src = await wikidataPhoto(p.name, demonyms);
        if (src) via = 'wiki';
      }
    }

    if (!src) {
      missing.push(`${p.team_id} #${p.shirt_number ?? '?'} ${p.name}`);
      continue;
    }

    // host it + repoint photo_url
    const publicUrl = await host(p.id, src);
    await sbPatch(`players?id=eq.${p.id}`, { photo_url: publicUrl });
    ckpt.hosted[p.id] = via;
    save();
    hosted++;
    if (via === 'api') viaApi++;
    else if (via === 'afnum') viaAfNum++;
    else if (via === 'wiki') viaWiki++;
    if (hosted % 50 === 0) console.log(`  …${hosted} hosted (api ${viaApi} · af# ${viaAfNum} · wiki ${viaWiki})`);
  } catch (e) {
    console.warn(`  ✗ ${p.team_id} ${p.name} (id ${p.id}): ${e.message}`);
    missing.push(`${p.team_id} #${p.shirt_number ?? '?'} ${p.name} [${e.message}]`);
  }
}

console.log(
  `\nDone. Hosted ${hosted} (api-sports ${viaApi} · af-number ${viaAfNum} · wikidata ${viaWiki}) · API-Football calls ${afCalls}`,
);
if (missing.length) {
  console.log(`Still missing (${missing.length}):\n  ` + missing.join('\n  '));
}
