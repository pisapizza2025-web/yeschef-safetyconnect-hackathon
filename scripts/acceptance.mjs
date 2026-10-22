// Runs the T01-T12 acceptance sweep against a RUNNING app over real HTTP.
// Usage: BASE_URL=http://localhost:3000 node scripts/acceptance.mjs
// Note: it creates demo cases in the target app's store. Run it against a scratch instance
// (set DATA_DIR to an empty folder) or reset data/db.json afterwards.
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const results = [];
const record = (id, name, ok, detail = '') => {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}${ok ? '' : `  -> ${detail}`}`);
};

class Client {
  constructor() { this.cookie = ''; }
  async req(path, opts = {}) {
    const res = await fetch(BASE + path, { ...opts, headers: { 'content-type': 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}), ...(opts.headers || {}) }, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    return res;
  }
  async json(path, body, method = 'POST') {
    const res = await this.req(path, { method, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }
  async html(path) { const res = await this.req(path); return { status: res.status, raw: await res.text() }; }
  actAs(id) { return this.json('/api/actor', { id }); }
}
const text = (raw) => raw.replace(/<!--.*?-->/gs, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const has = (t, s) => t.includes(s);
// removes negated phrases ("nobody was contacted") so only affirmative claims are tested
const noNeg = (t) => t.replace(/\b(nobody|none|no one|not|never|nothing)\b[^.;:)\n]{0,40}?\b(contacted|booked|available|verified|confirmed|made)\b/gi, ' ');

async function main() {
  const c = new Client();
  const health = await c.json('/api/health', undefined, 'GET');
  if (health.status !== 200) throw new Error(`App not reachable at ${BASE}`);

  await c.actAs('demo-manager');
  const actors = (await c.json('/api/actor', undefined, 'GET')).body.actors;
  const helperActor = actors.find((a) => a.role === 'helper');
  const supplierName = 'ColdLine'; // alpha's refrigeration supplier in the current fixtures
  const mk = async (siteId, type, facts) => (await c.json('/api/cases', { siteId, type, facts })).body.id;

  // T01
  const a1 = await mk('alpha', 'fridge', { reading: 9, exposure: 'unknown' });
  let p = text((await c.html(`/cases/${a1}`)).raw);
  record('T01', 'Fridge case at Site Alpha: report, procedure and known contractor shown',
    a1 && has(p, 'Fridge reading 9°C') && has(p, 'Refrigeration Incident Procedure') && has(p, supplierName) && !has(p, 'No supplier on file'), p.slice(0, 200));

  // T02
  const b1 = await mk('beta', 'fridge', { reading: 9 });
  p = text((await c.html(`/cases/${b1}`)).raw);
  record('T02', 'Same incident at Site Beta: no borrowed contractor, external handoff shown',
    has(p, 'No supplier on file for this site') && !has(p, supplierName) && has(p, 'Find a provider'));

  // T03
  const rawB = (await c.html(`/cases/${b1}`)).raw;
  const rawA = (await c.html(`/cases/${a1}`)).raw;
  const links = [...rawB.matchAll(/href="(https:\/\/www\.google\.com\/[^"]+)"/g)].map((m) => m[1]);
  const telsB = [...rawB.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  const extBlock = rawB.slice(rawB.indexOf('No supplier on file for this site'));
  const telsOutsideExternal = [...rawB.slice(0, rawB.indexOf('No supplier on file for this site')).matchAll(/href="(tel|mailto):/g)];
  record('T03', 'Contact options are real links only; no tel/mailto outside the external block; supplier without details shows none; no success claimed',
    links.length >= 1 && !/href="tel:/.test(rawA) && has(text(rawA), 'No contact details on file') && telsOutsideExternal.length === 0 &&
    (telsB.length === 0 || extBlock.includes('href="tel:')) &&
    !/\b(has been|was|is now) booked\b|on the way|contact (has been|was) (made|established)/i.test(noNeg(text(rawB))));
  await c.json(`/api/cases/${b1}/events`, { kind: 'handoff', target: 'web', label: 'Find a provider (web search)' });
  p = text((await c.html(`/cases/${b1}`)).raw);
  record('T03b', 'Opening a link is logged as "link opened", never as contact made',
    has(p, 'Link opened') && has(p, 'does not confirm contact was made'));

  // T04
  const act = await c.json(`/api/cases/${a1}/events`, { kind: 'action', text: 'Moved stock to the second fridge', category: 'isolate_food' });
  p = text((await c.html(`/cases/${a1}`)).raw); // a new request is the reload
  record('T04', 'Manager action persists after reload with actor and time',
    act.status === 200 && has(p, 'Moved stock to the second fridge') && has(p, 'Demo Manager') && has(p, 'Fridge reading 9°C'));

  // T05
  await c.actAs(helperActor.id);
  const msg = await c.json(`/api/cases/${a1}/events`, { kind: 'message', text: 'We check the door seal first.' });
  const helperAction = await c.json(`/api/cases/${a1}/events`, { kind: 'action', text: 'sneaky' });
  p = text((await c.html(`/cases/${a1}`)).raw);
  record('T05', 'Helper message appears with real actor; helper cannot record actions',
    msg.status === 200 && helperAction.status === 403 && has(p, 'We check the door seal first.') && has(p, `${helperActor.name} (self-declared helper)`));

  // T06
  await c.actAs('demo-manager');
  const cl = await c.json(`/api/cases/${a1}/events`, { kind: 'close', note: 'Fixed' });
  const late = await c.json(`/api/cases/${a1}/events`, { kind: 'action', text: 'late' });
  const re = await c.json(`/api/cases/${a1}/events`, { kind: 'reopen', note: 'High again' });
  p = text((await c.html(`/cases/${a1}`)).raw);
  record('T06', 'Close then reopen keeps actions and the failed reading',
    cl.status === 200 && late.status === 409 && re.status === 200 && has(p, 'Moved stock to the second fridge') && has(p, 'Above site limit') && has(p, 'Case closed') && has(p, 'Case reopened'));

  // T07
  const al = await mk('alpha', 'allergen', { product: '', note: 'Ingredient list unavailable' });
  p = text((await c.html(`/cases/${al}`)).raw);
  record('T07', 'Allergen case invents no ingredients and never declares safety',
    has(p, 'Allergen information is unverified') && has(p, 'Not named in the report') && !/safe to (serve|eat)|approved for (service|sale)|nothing to worry/i.test(p));

  // T08
  const ck = await mk('alpha', 'cooking', { reading: 68, item: '' });
  await c.json(`/api/cases/${ck}/events`, { kind: 'recheck', value: 76 });
  p = text((await c.html(`/cases/${ck}`)).raw);
  record('T08', 'Failed cooking reading stays on record beside the passing recheck',
    has(p, '68°C') && has(p, '76°C') && has(p, 'Below site limit') && has(p, 'Within site limit') && has(p, 'First reading') && has(p, 'Recheck'));

  // T09
  const rc = await mk('alpha', 'records', { required: 4, entries: [{ time: '11:30', value: '76' }, { time: '12:40', value: '78' }] });
  p = text((await c.html(`/cases/${rc}`)).raw);
  record('T09', 'Missing records: two real rows and two anonymous missing slots',
    has(p, '2 of 4 records present, 2 missing') && has(p, 'Record 1') && has(p, 'Record 2') && /Record 3\s+Missing/.test(p) && /Record 4\s+Missing/.test(p));

  // T10
  await c.json(`/api/cases/${a1}/events`, { kind: 'action', text: 'Asked DEMO Refrigeration Contractor, sam@example.com', category: 'contact_provider' });
  const cardOf = (raw) => text((raw.match(/<article[\s\S]*?<\/article>/g) || []).join(' '));
  const before = cardOf((await c.html('/learning')).raw);
  const rq = await c.json(`/api/cases/${a1}/learning`, { op: 'request', lesson: 'Ask Demo Manager at Demo Kitchen A' });
  const pend = cardOf((await c.html('/learning')).raw);
  const detail = text((await c.html(`/cases/${a1}`)).raw);
  const ap = await c.json(`/api/cases/${a1}/learning`, { op: 'approve' });
  const afterRaw = (await c.html('/learning')).raw;
  const after = text((afterRaw.match(/<article[\s\S]*?<\/article>/g) || []).join(' ')); // the cards only, not the header
  record('T10', 'Learning card: nothing shared until approved; card is redacted; state visible',
    rq.status === 200 && ap.status === 200 && !has(before, 'Walk-in fridge above its configured limit') && !has(pend, 'Walk-in fridge above its configured limit') &&
    has(detail, 'Pending approval') && has(after, 'Walk-in fridge above its configured limit') && !/Demo Kitchen|Demo Manager|DEMO Refrigeration|sam@example/.test(after));

  // T11
  const hh = (await c.json('/api/health', undefined, 'GET')).body;
  const rawAi = text((await c.html(`/cases/${a1}`)).raw);
  record('T11', 'Without AI the app shows labelled demo rules and stays usable',
    String(hh.ai).startsWith('not configured') && has(rawAi, 'Demo rules') && !has(rawAi, 'Live AI comment') && hh.evidenceChain?.ok === true,
    JSON.stringify(hh.ai));

  // T12
  const fresh = new Client();
  const home = await fresh.html('/');
  const direct = await fresh.html(`/cases/${a1}`);
  record('T12', 'Fresh browser without a session: home and a direct case URL work',
    home.status === 200 && direct.status === 200 && has(text(home.raw), 'Cases') && has(text(direct.raw), 'Fridge reading 9°C'));

  // T13 external providers (only where no internal supplier exists), copied exactly
  const fs = await import('node:fs');
  const ext = JSON.parse(fs.readFileSync(process.env.EXTERNAL_FILE || 'data/external-providers.json', 'utf8'));
  const biz = ext.results.filter((r) => r.source === 'external_business');
  const rawBeta = (await c.html(`/cases/${b1}`)).raw;
  const tB = text(rawBeta);
  const phonesOk = biz.every((b) => !b.contact.phone || tB.includes(`Call ${b.contact.phone}`));
  const emailsOk = biz.every((b) => !b.contact.email || tB.includes(`Email ${b.contact.email}`));
  const urlsOk = biz.every((b) => rawBeta.includes(`href="${b.citation.uri}"`));
  const tA = text((await c.html(`/cases/${a1}`)).raw);
  record('T13', 'Site B lists the researched providers exactly as in the file, with a snapshot label; Site A lists none',
    biz.length > 0 && phonesOk && emailsOk && urlsOk && has(tB, 'Research snapshot') && has(tB, 'Nobody has been contacted and availability is not confirmed') &&
    !/\b(is|are|was|were|has been|have been) (now )?(available|booked|verified|contacted)\b/i.test(noNeg(tB.replace(/Its website says: “[^”]*”/g, ' '))) &&
    !biz.some((b) => tA.includes(b.title)));
  const alAl = await mk('alpha', 'allergen', { product: '', note: 'Ingredient list unavailable' });
  const tAl = text((await c.html(`/cases/${alAl}`)).raw);
  record('T13b', 'Allergen at Site A shows the known sauce supplier with no contact details and no external options',
    has(tAl, 'Riverside Sauces') && has(tAl, 'No contact details on file') && !has(tAl, 'Research snapshot'));

  // Evidence integrity
  const hh2 = (await c.json('/api/health', undefined, 'GET')).body;
  record('EV', 'Evidence hash chain verifies after the whole sweep', hh2.evidenceChain?.ok === true, JSON.stringify(hh2.evidenceChain));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  console.log('Not covered by this script (check by hand): visual layout, mobile width, real tel:/browser behaviour on a device, live Grok call.');
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e.message); process.exit(2); });
