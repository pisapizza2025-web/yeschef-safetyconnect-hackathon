import { beforeEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { findActor, loadFixtures, siteSettings, demoActors } from '@/lib/fixtures';
import {
  seededLearningCards, addAction, addMessage, addRecheck, approvedLearningCards, closeCase, createCase, decideLearning,
  getCase, listCases, logHandoff, reopenCase, requestLearning,
} from '@/lib/cases';
import { chainStatus, listEvents, verifyChain } from '@/lib/store';
import { containsUnsafeClaim, redactText } from '@/lib/guards';
import { buildAssessment } from '@/lib/assess';


/** Removes negated phrases such as "nobody was contacted" so only affirmative claims are tested. */
const withoutNegations = (t: string) =>
  t.replace(/\b(nobody|none|no one|not|never|nothing)\b[^.;:)\n]{0,40}?\b(contacted|booked|available|verified|confirmed|made)\b/gi, ' ');

const manager = () => findActor('demo-manager');
const chef = () => findActor('demo-chef');
const helper = () => findActor(loadFixtures().helpers[0].id);

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'sc-test-'));
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_MODEL;
  loadFixtures(true);
});

describe('T01 fridge case at the site with a known supplier', () => {
  it('saves the case, shows the internal procedure and the known contractor, no external fallback', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9, exposure: 'unknown' } }, manager());
    const v = await getCase(id);
    expect(v.facts.reading).toBe(9);
    expect(v.internal?.procedure?.title).toContain('Refrigeration Incident Procedure');
    expect(v.internal?.suppliers[0].name).toContain('ColdLine');
    expect(v.external).toBeNull();
    expect(v.assessment?.flag).toBe('above_limit');
    expect(v.assessment?.cautions.join(' ')).toContain('do not assume the food is safe');
  });
});

describe('T02 same incident at the site without a supplier', () => {
  it('does not borrow the contractor from the other site and prepares an external handoff', async () => {
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    expect(v.internal?.suppliers).toEqual([]);
    expect(v.external?.links.length).toBeGreaterThan(0);
  });
});

describe('T03 contact options are real links only and never claim contact succeeded', () => {
  it('external links are https searches; a handoff event only records that a link was opened', async () => {
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    for (const l of v.external!.links) expect(l.url.startsWith('https://')).toBe(true);
    await logHandoff(id, manager(), { kind: 'web', label: 'Web search' });
    const after = await getCase(id);
    const text = after.events.map((e) => JSON.stringify(e.data)).join(' ').toLowerCase();
    expect(withoutNegations(text)).not.toMatch(/\b(has been|was|is now) booked\b|on the way|contact (has been|was) (made|established)|has (arrived|been contacted)/);
  });
  it('the demo supplier has no invented phone or email', () => {
    for (const s of loadFixtures().suppliers) {
      expect(s.phone ?? null).toBeNull();
      expect(s.email ?? null).toBeNull();
    }
  });
});

describe('T04 manager action survives a reload and is attributed', () => {
  it('keeps the case and the action with actor and timestamp', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await addAction(id, manager(), { text: 'Moved stock to the second fridge', category: 'isolate_food' });
    const v = await getCase(id); // a fresh read from disk is the reload
    expect(v.actions).toHaveLength(1);
    expect(v.actions[0].actor.name).toBe('Demo Manager');
    expect(new Date(v.actions[0].at).toString()).not.toBe('Invalid Date');
    expect(v.events[0].type).toBe('case.created');
  });
  it('refuses an action from a helper', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await expect(addAction(id, helper(), { text: 'x' })).rejects.toThrow('Only venue staff');
  });
});

describe('T05 helper message', () => {
  it('appears in the thread with the real actor, marked self-declared', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await addMessage(id, helper(), 'In my kitchen we check the door seal first.');
    const v = await getCase(id);
    expect(v.messages[0].actor.name).toBe(helper().name);
    expect(v.messages[0].actor.selfDeclared).toBe(true);
  });
});

describe('T06 close then reopen keeps history', () => {
  it('preserves earlier actions, failed readings and messages', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await addAction(id, chef(), { text: 'Called the contractor line', category: 'contact_provider' });
    await closeCase(id, manager(), 'Fixed');
    expect((await getCase(id)).status).toBe('Closed');
    await expect(addAction(id, chef(), { text: 'late' })).rejects.toThrow('closed');
    await reopenCase(id, manager(), 'Reading is high again');
    const v = await getCase(id);
    expect(v.status).toBe('Open');
    expect(v.actions).toHaveLength(1);
    expect(v.readings[0].ok).toBe(false);
  });
  it('only a manager can close', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await expect(closeCase(id, chef())).rejects.toThrow('Only a manager');
  });
});

describe('T07 allergen case', () => {
  it('invents no ingredients and never declares the product safe', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'allergen', facts: { product: '', note: 'Ingredient list unavailable' } }, manager());
    const v = await getCase(id);
    expect(v.assessment?.flag).toBe('unverified');
    const all = JSON.stringify(v.assessment).toLowerCase();
    expect(containsUnsafeClaim(all)).toBe(false);
    expect(all).toContain('not named');
    expect(v.facts.product).toBe('');
  });
});

describe('T08 cooking: a failed measurement is not overwritten by a recheck', () => {
  it('keeps both readings in order', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'cooking', facts: { reading: 68 } }, manager());
    await addRecheck(id, chef(), 76);
    const v = await getCase(id);
    expect(v.readings.map((r) => [r.kind, r.value, r.ok])).toEqual([
      ['first', 68, false],
      ['recheck', 76, true],
    ]);
    expect(v.readings[0].label).toBe('Below site limit');
  });
});

describe('T09 missing records', () => {
  it('shows two real entries and two anonymous missing slots, no guessed labels', async () => {
    const id = await createCase(
      { siteId: 'alpha', type: 'records', facts: { required: 4, entries: [{ time: '11:30', value: '76' }, { time: '12:40', value: '78' }] } },
      manager(),
    );
    const v = await getCase(id);
    expect((v.facts.entries as unknown[]).length).toBe(2);
    expect(v.assessment?.headline).toBe('2 of 4 records present, 2 missing');
    expect(JSON.stringify(v.assessment)).not.toMatch(/chicken|salmon|beef|lasagne/i);
  });
  it('rejects more entries than required', async () => {
    await expect(createCase({ siteId: 'alpha', type: 'records', facts: { required: 1, entries: [{}, {}] } }, manager())).rejects.toThrow('More records');
  });
});

describe('T10 opt-in community learning', () => {
  it('is not shared until approved, and the card is redacted', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await addAction(id, manager(), { text: 'Called DEMO ColdLine Refrigeration on 07700 900123', category: 'contact_provider' });
    expect((await getCase(id)).learning.state).toBe('none');
    expect(await approvedLearningCards()).toHaveLength(0);

    await requestLearning(id, manager(), 'Ask Demo Manager at Demo Kitchen A: sam@example.com');
    const pending = await getCase(id);
    expect(pending.learning.state).toBe('pending');
    expect(await approvedLearningCards()).toHaveLength(0);
    const card = JSON.stringify(pending.learning.card);
    expect(card).not.toMatch(/Demo Kitchen|Demo Manager|ColdLine|sam@example|07700/);

    await decideLearning(id, manager(), true);
    expect((await getCase(id)).learning.state).toBe('approved');
    expect(await approvedLearningCards()).toHaveLength(1);
  });
  it('external provider names in a lesson are removed from the card', async () => {
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    await requestLearning(id, manager(), 'We rang kept cold and Chef Cool Refrigeration, then Bear Building Services and London HVAC Pro');
    const card = JSON.stringify((await getCase(id)).learning.card);
    expect(card).not.toMatch(/kept cold|chef cool|bear building|london hvac/i);
    expect(card).toContain('[name removed]');
  });
  it('a shortened helper or supplier name in a lesson is removed, without mangling other words', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await requestLearning(id, manager(), 'Priya and Tom said ask ColdLine Refrigeration about it tomorrow, the customer agreed');
    const card = JSON.stringify((await getCase(id)).learning.card);
    expect(card).not.toMatch(/priya|Tom|coldline/i);
    expect(card).toContain('tomorrow');
    expect(card).toContain('customer');
  });
  it('a rejected card is never listed', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'cooking', facts: { reading: 60 } }, manager());
    await requestLearning(id, manager());
    await decideLearning(id, manager(), false);
    expect((await getCase(id)).learning.state).toBe('rejected');
    expect(await approvedLearningCards()).toHaveLength(0);
  });
});

describe('T11 no AI available', () => {
  it('falls back to labelled rules and the app still works', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    expect(v.assessment?.mode).toBe('rules');
    expect(v.assessment?.note).toContain('not configured');
  });
  it('a failing live call also falls back and is not labelled live', async () => {
    process.env.XAI_API_KEY = 'test';
    process.env.XAI_MODEL = 'test-model';
    process.env.XAI_BASE_URL = 'http://127.0.0.1:9/v1'; // nothing listens here
    const a = await buildAssessment('fridge', { reading: 9 }, { fridgeMaxC: 8, cookingMinC: 75 }, 'Demo Kitchen A');
    expect(a.mode).toBe('rules');
    expect(a.note).toContain('unavailable');
    delete process.env.XAI_BASE_URL;
  });
  it('an AI answer that claims safety is rejected', async () => {
    expect(containsUnsafeClaim('The food is safe to serve')).toBe(true);
    expect(containsUnsafeClaim('Check the door seal and the thermostat')).toBe(false);
  });
});

describe('evidence timeline integrity', () => {
  it('is append-only, in order, and a hash chain that detects tampering', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    await addAction(id, manager(), { text: 'one' });
    await addMessage(id, helper(), 'two');
    const events = await listEvents();
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect((await chainStatus()).ok).toBe(true);

    const tampered = JSON.parse(JSON.stringify(events));
    tampered[1].data.suppliers = [{ name: 'Invented Co' }];
    expect(verifyChain(tampered).ok).toBe(false);

    const file = path.join(process.env.DATA_DIR!, 'db.json');
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    raw.events[2].data.text = 'edited later';
    writeFileSync(file, JSON.stringify(raw));
    expect((await chainStatus()).ok).toBe(false);
  });
});

describe('validation and listing', () => {
  it('rejects a missing reading and an unknown site', async () => {
    await expect(createCase({ siteId: 'alpha', type: 'fridge', facts: {} }, manager())).rejects.toThrow('fridge reading');
    await expect(createCase({ siteId: 'nope', type: 'fridge', facts: { reading: 5 } }, manager())).rejects.toThrow('Choose a site');
  });
  it('lists newest first with the status flag', async () => {
    await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 5 } }, manager());
    await new Promise((r) => setTimeout(r, 5));
    await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const list = await listCases();
    expect(list).toHaveLength(2);
    expect(list[0].siteId).toBe('beta');
    expect(list[0].flag).toBe('above_limit');
    expect(list[1].flag).toBe('within_limit');
  });
  it('redaction removes contact details and names', () => {
    expect(redactText('Call Sam on +44 20 7946 0000 or sam@x.co, see https://x.co', ['Sam'])).toBe(
      'Call [name removed] on [number removed] or [email removed], see [link removed]',
    );
  });
});


// ---------------------------------------------------------------------------
// Fixture adapter (Grok Bot file shape) and the external research snapshot
// ---------------------------------------------------------------------------
import { readFileSync as readFile } from 'node:fs';

const ROOT = process.cwd();

describe('fixtures adapter reads the Grok Bot file shape', () => {
  it('maps names, helpers, supplier source and site limits', () => {
    const f = loadFixtures();
    expect(f.sites.map((x) => x.label)).toEqual(['Demo Kitchen A', 'Demo Kitchen B']);
    expect(f.helpers).toHaveLength(4);
    expect(f.helpers[0].name).toContain('DEMO Priya');
    expect(demoActors().filter((a) => a.role === 'helper' && a.selfDeclared)).toHaveLength(4);
    const cold = f.suppliers.find((x) => x.name.includes('ColdLine'))!;
    expect(cold.source).toBe('Demo Kitchen A approved supplier list (DEMO)');
    expect(siteSettings('alpha').fridgeMaxC).toBe(5);
    expect(siteSettings('beta').fridgeMaxC).toBe(8);
    expect(siteSettings('alpha').cookingMinC).toBe(75);
  });

  it('derives report-form starters from the scenario text', () => {
    const f = loadFixtures();
    const by = (t: string) => f.scenarios.find((x) => x.type === t)!.starter as Record<string, any>;
    expect(by('fridge')).toMatchObject({ reading: 9, exposure: 'unknown' });
    expect(by('cooking').reading).toBe(68);
    expect(by('records').required).toBe(4);
    expect(by('records').entries).toHaveLength(2);
    expect(by('records').entries[0]).toMatchObject({ time: '12:15', value: '78', item: 'Roast chicken thighs (DEMO)' });
    expect(by('allergen').note).toContain('Ingredient list unavailable');
  });

  it('keeps ignoring keys it does not read, and still loads the older built-in shape', () => {
    process.env.FIXTURES_FILE = path.join(ROOT, 'data', 'demo-fixtures.builtin.json');
    try {
      const old = loadFixtures(true);
      expect(old.helpers[0].name).toBe('Demo Helper Sam');
      expect(old.sites[0].label).toBe('Demo Kitchen A');
      expect(siteSettings('alpha').fridgeMaxC).toBe(8); // explicit site settings in the older shape
      expect(old.suppliers[0].name).toBe('DEMO Refrigeration Contractor');
    } finally {
      delete process.env.FIXTURES_FILE;
      loadFixtures(true);
    }
  });
});

describe('external providers appear only where no internal supplier exists', () => {
  it('Site Beta shows the research snapshot, character for character, and never the Alpha supplier', async () => {
    const file = JSON.parse(readFile(path.join(ROOT, 'data', 'external-providers.json'), 'utf8'));
    const businesses = file.results.filter((r: any) => r.source === 'external_business');
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    expect(v.internal?.suppliers).toEqual([]);
    expect(v.external?.providers).toHaveLength(businesses.length);
    businesses.forEach((b: any, i: number) => {
      const p = v.external!.providers[i];
      expect(p.title).toBe(b.title);
      expect(p.contact.phone).toBe(b.contact.phone); // exact string, spaces included
      expect(p.contact.email).toBe(b.contact.email);
      expect(p.citation.uri).toBe(b.citation.uri);
    });
    expect(v.external?.snapshot?.retrievedAt).toBe(file.meta.retrievedAt);
    expect(v.external?.links.map((l) => l.url)).toEqual(
      file.results.filter((r: any) => r.source === 'external_search_link').map((r: any) => r.citation.uri),
    );
    expect(JSON.stringify(v)).not.toContain('ColdLine');
  });

  it('Site Alpha has its own supplier and shows no external providers', async () => {
    const id = await createCase({ siteId: 'alpha', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    expect(v.internal?.suppliers[0].name).toContain('ColdLine');
    expect(v.external).toBeNull();
  });

  it('the app never writes words that claim contact, booking, availability or verification', async () => {
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    const { describeEvent } = await import('@/lib/format');
    const text = v.events.map((e) => describeEvent(e)).join(' ');
    expect(withoutNegations(text)).not.toMatch(/\b(is|are|was|were|has been|have been) (now )?(available|booked|verified|contacted)\b/i);
    expect(text).toContain('availability not confirmed');
  });

  it('a payload without a research file falls back to plain search links', async () => {
    process.env.EXTERNAL_PROVIDERS_FILE = path.join(os.tmpdir(), 'does-not-exist.json');
    loadFixtures(true);
    const id = await createCase({ siteId: 'beta', type: 'fridge', facts: { reading: 9 } }, manager());
    const v = await getCase(id);
    expect(v.external?.providers).toEqual([]);
    expect(v.external?.links.length).toBeGreaterThan(0);
    delete process.env.EXTERNAL_PROVIDERS_FILE;
    loadFixtures(true);
  });
});

describe('allergen: known supplier is shown, nothing external', () => {
  it('Alpha lists the sauce supplier with no contact details; Beta has none and no external fallback', async () => {
    const a = await getCase(await createCase({ siteId: 'alpha', type: 'allergen', facts: { product: '', note: '' } }, manager()));
    expect(a.internal?.suppliers.map((x) => x.name).join(' ')).toContain('Riverside Sauces');
    expect(a.internal?.suppliers[0].phone).toBeNull();
    expect(a.external).toBeNull();
    const b = await getCase(await createCase({ siteId: 'beta', type: 'allergen', facts: { product: '', note: '' } }, manager()));
    expect(b.internal?.suppliers).toEqual([]);
    expect(b.external).toBeNull();
  });
});

describe('records keep the item labels the report gave and invent none', () => {
  it('shows item names only for real rows', async () => {
    const id = await createCase(
      { siteId: 'alpha', type: 'records', facts: { required: 4, entries: [{ time: '12:15', value: '78', item: 'Roast chicken thighs (DEMO)' }, { time: '14:40', value: '80', item: 'Beef lasagne (DEMO)' }] } },
      manager(),
    );
    const v = await getCase(id);
    expect((v.facts.entries as any[]).map((e) => e.item)).toEqual(['Roast chicken thighs (DEMO)', 'Beef lasagne (DEMO)']);
    expect(v.assessment?.headline).toBe('2 of 4 records present, 2 missing');
  });
});

describe('seeded demo learning example', () => {
  it('comes from the fixtures and is separate from case-derived cards', async () => {
    expect(seededLearningCards()).toHaveLength(1);
    expect(await approvedLearningCards()).toHaveLength(0);
  });
});

describe('external provider links', () => {
  it('rejects a link that is not http(s), naming the field', () => {
    const f = path.join(mkdtempSync(path.join(os.tmpdir(), 'sc-ext-')), 'p.json');
    writeFileSync(f, JSON.stringify({
      meta: { siteId: 'beta', category: 'fridge', retrievedAt: '2026-10-22T18:26:54Z' },
      results: [{ id: 'a', source: 'external_business', title: 't', citation: { label: 'l', uri: 'javascript:alert(1)' } }],
    }));
    process.env.EXTERNAL_PROVIDERS_FILE = f;
    expect(() => loadFixtures(true)).toThrow(/uri/);
    delete process.env.EXTERNAL_PROVIDERS_FILE;
    loadFixtures(true);
  });
});
