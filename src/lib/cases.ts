import crypto from 'node:crypto';
import { AppError, SCENARIO_TYPES, type Actor, type EventRecord, type ExternalProvider, type ScenarioType, type Site } from './types';
import { loadFixtures, siteSettings } from './fixtures';
import { appendEvents, eventsFor, listEvents } from './store';
import { ACTION_LABELS, num, readingLabel, readingOk, type ActionCategory, type Flag, type Suggestion } from './rules';
import { buildAssessment } from './assess';
import { clean, redactText } from './guards';

export const SYSTEM_ACTOR: Actor = { id: 'system', name: 'SafetyConnect system', role: 'staff' };

// ---------- input handling ----------

function normalizeFacts(type: ScenarioType, raw: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'fridge': {
      const reading = num(raw.reading);
      if (reading === null || reading < -40 || reading > 60) throw new AppError(400, 'Enter the fridge reading in °C.');
      const exposure = clean(raw.exposure, 80) || 'unknown';
      return { reading, exposure };
    }
    case 'cooking': {
      const reading = num(raw.reading);
      if (reading === null || reading < -20 || reading > 250) throw new AppError(400, 'Enter the probe reading in °C.');
      return { reading, item: clean(raw.item, 80) };
    }
    case 'allergen':
      return { product: clean(raw.product, 80), note: clean(raw.note, 200) };
    case 'records': {
      const required = num(raw.required);
      if (required === null || !Number.isInteger(required) || required < 1 || required > 20) {
        throw new AppError(400, 'Enter how many records are required (1 to 20).');
      }
      const list = Array.isArray(raw.entries) ? raw.entries : [];
      const entries = list.slice(0, 20).map((e) => {
        const r = (e ?? {}) as Record<string, unknown>;
        return { time: clean(r.time, 20), value: clean(r.value, 20), loggedBy: clean(r.loggedBy, 60), item: clean(r.item, 60) };
      });
      if (entries.length > required) throw new AppError(400, 'More records entered than required.');
      return { required, entries };
    }
  }
}

function makeTitle(type: ScenarioType, facts: Record<string, unknown>, scenarioTitle?: string): string {
  if (type === 'fridge') return `Fridge reading ${facts.reading}°C`;
  if (type === 'cooking') return `Cooking probe reading ${facts.reading}°C`;
  if (type === 'allergen') return scenarioTitle ?? 'Unverified allergen information';
  const required = facts.required as number;
  const have = (facts.entries as unknown[]).length;
  return `Daily records: ${have} of ${required} present`;
}

function limitFor(type: ScenarioType, siteId: string): { kind: string; value: number } | null {
  const s = siteSettings(siteId);
  if (type === 'fridge') return { kind: 'fridgeMaxC', value: s.fridgeMaxC };
  if (type === 'cooking') return { kind: 'cookingMinC', value: s.cookingMinC };
  return null;
}

export function searchLinks(need: string, site: Site): { label: string; url: string }[] {
  const near = process.env.SEARCH_NEAR || site.city || 'London';
  const q = encodeURIComponent(`commercial ${need} repair engineer near ${near}`);
  return [
    { label: 'Web search', url: `https://www.google.com/search?q=${q}` },
    { label: 'Map search', url: `https://www.google.com/maps/search/${q}` },
  ];
}

// ---------- derived view ----------

export interface ReadingView {
  id: string;
  kind: 'first' | 'recheck';
  value: number;
  at: string;
  actor: Actor;
  limit: number;
  ok: boolean;
  label: string;
}
export interface ActionView {
  id: string;
  at: string;
  actor: Actor;
  text: string;
  category: ActionCategory;
}
export interface MessageView {
  id: string;
  at: string;
  actor: Actor;
  text: string;
}
export interface LearningCard {
  id: string;
  title: string;
  whatHappened: string;
  whatHelped: string[];
  lesson: string;
  redacted: true;
}
export type LearningState = 'none' | 'pending' | 'approved' | 'rejected';

export interface CaseView {
  id: string;
  siteId: string;
  siteLabel: string;
  type: ScenarioType;
  title: string;
  status: 'Open' | 'Closed';
  createdAt: string;
  createdBy: Actor;
  facts: Record<string, unknown>;
  limit: { kind: string; value: number } | null;
  readings: ReadingView[];
  internal: {
    procedure: { title: string; version: string; body: string; sourceLabel?: string } | null;
    suppliers: { name: string; phone: string | null; email: string | null; isFictional: boolean; source: string }[];
  } | null;
  external: {
    need: string;
    links: { label: string; url: string }[];
    providers: ExternalProvider[];
    snapshot: { retrievedAt: string; note: string } | null;
  } | null;
  assessment: {
    mode: 'grok' | 'rules';
    flag: Flag;
    headline: string;
    items: Suggestion[];
    cautions: string[];
    ai?: { text: string; model: string };
    note: string;
  } | null;
  actions: ActionView[];
  messages: MessageView[];
  learning: { state: LearningState; card?: LearningCard; requestedBy?: Actor; decidedBy?: Actor; decidedAt?: string };
  events: EventRecord[];
}

function derive(events: EventRecord[]): CaseView {
  const created = events.find((e) => e.type === 'case.created');
  if (!created) throw new AppError(404, 'Case not found.');
  const d = created.data as {
    siteId: string;
    siteLabel: string;
    type: ScenarioType;
    title: string;
    facts: Record<string, unknown>;
    limit: { kind: string; value: number } | null;
  };
  const view: CaseView = {
    id: created.caseId,
    siteId: d.siteId,
    siteLabel: d.siteLabel,
    type: d.type,
    title: d.title,
    status: 'Open',
    createdAt: created.at,
    createdBy: created.actor,
    facts: d.facts,
    limit: d.limit,
    readings: [],
    internal: null,
    external: null,
    assessment: null,
    actions: [],
    messages: [],
    learning: { state: 'none' },
    events,
  };
  if (d.limit && (d.type === 'fridge' || d.type === 'cooking')) {
    const v = num(d.facts.reading) as number;
    view.readings.push({
      id: created.id,
      kind: 'first',
      value: v,
      at: created.at,
      actor: created.actor,
      limit: d.limit.value,
      ok: readingOk(d.type, v, d.limit.value),
      label: readingLabel(d.type, v, d.limit.value),
    });
  }
  for (const e of events) {
    const data = e.data as Record<string, any>;
    switch (e.type) {
      case 'source.internal':
        view.internal = { procedure: data.procedure ?? null, suppliers: data.suppliers ?? [] };
        break;
      case 'source.external':
        view.external = { need: data.need, links: data.links, providers: data.providers ?? [], snapshot: data.snapshot ?? null };
        break;
      case 'assessment.recorded':
        view.assessment = {
          mode: data.mode,
          flag: data.flag,
          headline: data.headline,
          items: data.items,
          cautions: data.cautions,
          ai: data.ai,
          note: data.note,
        };
        break;
      case 'recheck.recorded':
        if (d.limit) {
          view.readings.push({
            id: e.id,
            kind: 'recheck',
            value: data.value,
            at: e.at,
            actor: e.actor,
            limit: d.limit.value,
            ok: readingOk(d.type, data.value, d.limit.value),
            label: readingLabel(d.type, data.value, d.limit.value),
          });
        }
        break;
      case 'action.recorded':
        view.actions.push({ id: e.id, at: e.at, actor: e.actor, text: data.text, category: data.category });
        break;
      case 'message.added':
        view.messages.push({ id: e.id, at: e.at, actor: e.actor, text: data.text });
        break;
      case 'case.closed':
        view.status = 'Closed';
        break;
      case 'case.reopened':
        view.status = 'Open';
        break;
      case 'learning.requested':
        view.learning = { state: 'pending', card: data.card, requestedBy: e.actor };
        break;
      case 'learning.approved':
        view.learning = { ...view.learning, state: 'approved', decidedBy: e.actor, decidedAt: e.at };
        break;
      case 'learning.rejected':
        view.learning = { ...view.learning, state: 'rejected', decidedBy: e.actor, decidedAt: e.at };
        break;
      default:
        break;
    }
  }
  return view;
}

export async function getCase(id: string): Promise<CaseView> {
  const ev = await eventsFor(id);
  if (!ev.length) throw new AppError(404, 'Case not found.');
  return derive(ev);
}

export interface CaseSummary {
  id: string;
  title: string;
  siteId: string;
  siteLabel: string;
  type: ScenarioType;
  status: 'Open' | 'Closed';
  createdAt: string;
  flag: Flag | null;
  headline: string | null;
  eventCount: number;
}

export async function listCases(): Promise<CaseSummary[]> {
  const all = await listEvents();
  const byCase = new Map<string, EventRecord[]>();
  for (const e of all) {
    const list = byCase.get(e.caseId) ?? [];
    list.push(e);
    byCase.set(e.caseId, list);
  }
  const out: CaseSummary[] = [];
  for (const events of byCase.values()) {
    const v = derive(events);
    out.push({
      id: v.id,
      title: v.title,
      siteId: v.siteId,
      siteLabel: v.siteLabel,
      type: v.type,
      status: v.status,
      createdAt: v.createdAt,
      flag: v.assessment?.flag ?? null,
      headline: v.assessment?.headline ?? null,
      eventCount: events.length,
    });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------- commands ----------

export async function createCase(
  input: { siteId: string; type: string; facts?: Record<string, unknown> },
  actor: Actor,
): Promise<string> {
  const f = loadFixtures();
  const site = f.sites.find((s) => s.id === input.siteId);
  if (!site) throw new AppError(400, 'Choose a site.');
  if (!SCENARIO_TYPES.includes(input.type as ScenarioType)) throw new AppError(400, 'Choose an incident type.');
  if (actor.role === 'helper') throw new AppError(403, 'Helpers can comment on a case but cannot report one.');
  const type = input.type as ScenarioType;
  const facts = normalizeFacts(type, input.facts ?? {});
  const scenario = f.scenarios.find((s) => s.type === type);
  const title = makeTitle(type, facts, scenario?.title);
  const limit = limitFor(type, site.id);
  const caseId = `SC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  // Internal first: this site's own procedure and supplier list.
  const procedure = f.procedures.find((p) => p.siteId === site.id && p.category === type) ?? null;
  // Known suppliers by service tag. Only a missing service provider (fridge) falls back to external options.
  const SUPPLIER_TAG: Partial<Record<ScenarioType, string>> = { fridge: 'refrigeration', allergen: 'food-supplier' };
  const tag = SUPPLIER_TAG[type] ?? null;
  const suppliers = tag ? f.suppliers.filter((s) => s.siteId === site.id && s.serviceTags.includes(tag)) : [];
  const need = type === 'fridge' ? 'refrigeration' : null;

  const settings = siteSettings(site.id);
  const assessment = await buildAssessment(type, facts, settings, site.label);

  const events: { type: EventRecord['type']; actor: Actor; data: Record<string, unknown> }[] = [
    {
      type: 'case.created',
      actor,
      data: { siteId: site.id, siteLabel: site.label, type, title, facts, limit },
    },
    {
      type: 'source.internal',
      actor: SYSTEM_ACTOR,
      data: {
        origin: 'internal',
        procedure: procedure
          ? { title: procedure.title, version: procedure.version, body: procedure.body, sourceLabel: procedure.sourceLabel ?? null }
          : null,
        suppliers: suppliers.map((s) => ({
          name: s.name,
          phone: s.phone ?? null,
          email: s.email ?? null,
          isFictional: Boolean(s.isFictional),
          source: s.source ?? 'Site supplier list',
        })),
      },
    },
  ];
  if (need && suppliers.length === 0) {
    const ext = f.external;
    const research = ext && (!ext.siteId || ext.siteId === site.id) && (!ext.category || ext.category === type) ? ext : null;
    const links = research?.links.length
      ? research.links.map((l) => ({ label: /\/maps\//.test(l.uri) ? 'Map search' : 'Web search', url: l.uri }))
      : searchLinks(need, site);
    events.push({
      type: 'source.external',
      actor: SYSTEM_ACTOR,
      data: {
        origin: 'external',
        need,
        links,
        providers: research?.providers ?? [],
        snapshot: research ? { retrievedAt: research.retrievedAt, note: research.note } : null,
      },
    });
  }
  events.push({
    type: 'assessment.recorded',
    actor: SYSTEM_ACTOR,
    data: {
      mode: assessment.mode,
      flag: assessment.rules.flag,
      headline: assessment.rules.headline,
      items: assessment.rules.items,
      cautions: assessment.rules.cautions,
      ai: assessment.ai ?? null,
      note: assessment.note,
    },
  });
  await appendEvents(caseId, events);
  return caseId;
}

function mustBeOpen(v: CaseView) {
  if (v.status === 'Closed') throw new AppError(409, 'This case is closed. Reopen it first.');
}
function needRole(actor: Actor, roles: Actor['role'][], message: string) {
  if (!roles.includes(actor.role)) throw new AppError(403, message);
}

export async function addAction(id: string, actor: Actor, input: { text: string; category?: string }) {
  const v = await getCase(id);
  needRole(actor, ['manager', 'staff'], 'Only venue staff can record actions.');
  mustBeOpen(v);
  const text = clean(input.text, 300);
  if (!text) throw new AppError(400, 'Describe the action taken.');
  const category = (Object.keys(ACTION_LABELS).includes(String(input.category)) ? input.category : 'other') as ActionCategory;
  await appendEvents(id, [{ type: 'action.recorded', actor, data: { text, category } }]);
}

export async function addMessage(id: string, actor: Actor, text: string) {
  const v = await getCase(id);
  mustBeOpen(v);
  const t = clean(text, 500);
  if (!t) throw new AppError(400, 'Write a message.');
  await appendEvents(id, [{ type: 'message.added', actor, data: { text: t } }]);
}

export async function addRecheck(id: string, actor: Actor, value: unknown) {
  const v = await getCase(id);
  needRole(actor, ['manager', 'staff'], 'Only venue staff can record readings.');
  mustBeOpen(v);
  if (!v.limit) throw new AppError(400, 'This incident type has no readings.');
  const n = num(value);
  if (n === null || n < -40 || n > 250) throw new AppError(400, 'Enter the reading in °C.');
  await appendEvents(id, [{ type: 'recheck.recorded', actor, data: { value: n } }]);
}

export async function logHandoff(id: string, actor: Actor, input: { kind: string; label: string }) {
  await getCase(id);
  needRole(actor, ['manager', 'staff'], 'Only venue staff can contact providers.');
  const kind = ['tel', 'mailto', 'web'].includes(input.kind) ? input.kind : 'web';
  // Records only that a link was opened. It never says contact was made.
  await appendEvents(id, [{ type: 'handoff.opened', actor, data: { kind, label: clean(input.label, 80) } }]);
}

export async function closeCase(id: string, actor: Actor, note?: string) {
  const v = await getCase(id);
  needRole(actor, ['manager'], 'Only a manager can close a case.');
  mustBeOpen(v);
  await appendEvents(id, [{ type: 'case.closed', actor, data: { note: clean(note, 300) } }]);
}

export async function reopenCase(id: string, actor: Actor, note?: string) {
  const v = await getCase(id);
  needRole(actor, ['manager'], 'Only a manager can reopen a case.');
  if (v.status === 'Open') throw new AppError(409, 'This case is already open.');
  await appendEvents(id, [{ type: 'case.reopened', actor, data: { note: clean(note, 300) } }]);
}

// ---------- community learning (opt-in, redacted, approved) ----------

const LEARNING: Record<ScenarioType, { title: string; happened: string; lesson: string }> = {
  fridge: {
    title: 'Walk-in fridge above its configured limit',
    happened: 'A fridge reading went above the venue\'s configured limit.',
    lesson: 'Escalate early, hold affected food until it has been assessed, and keep every reading and action on record.',
  },
  allergen: {
    title: 'Product with unverified allergen information',
    happened: 'A supplied product arrived without a usable ingredient or allergen list.',
    lesson: 'Never assume an unknown product is free of an allergen. Hold it back and get written confirmation from the supplier.',
  },
  cooking: {
    title: 'Cooking temperature below the configured limit',
    happened: 'A probe reading came in below the venue\'s configured cooking limit.',
    lesson: 'Keep cooking, measure again, and record both readings. The first reading stays on record.',
  },
  records: {
    title: 'Daily food safety records missing',
    happened: 'Fewer daily records were present than the venue requires.',
    lesson: 'Do not back-fill from memory. Record the gap and complete the next record on time.',
  },
};

/** "DEMO Priya, sous chef (fictional)" is also typed as "DEMO Priya" or "Priya". */
function nameVariants(name: string): string[] {
  const short = name.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim();
  return [name, short, short.replace(/^DEMO\s+/i, '')];
}

function namesToRedact(v: CaseView): string[] {
  const f = loadFixtures();
  const names = new Set<string>([v.siteLabel]);
  for (const e of v.events) names.add(e.actor.name);
  for (const s of f.suppliers) nameVariants(s.name).forEach((n) => names.add(n));
  for (const h of f.helpers) nameVariants(h.name).forEach((n) => names.add(n));
  for (const p of f.external?.providers ?? []) names.add(p.title);
  for (const s of f.sites) names.add(s.label);
  return [...names];
}

export function buildLearningCard(v: CaseView, lesson?: string): LearningCard {
  const t = LEARNING[v.type];
  const helped = [...new Set(v.actions.map((a) => ACTION_LABELS[a.category]))];
  const extra = lesson ? redactText(clean(lesson, 300), namesToRedact(v)) : '';
  return {
    id: v.id,
    title: t.title,
    whatHappened: t.happened,
    whatHelped: helped,
    lesson: extra ? `${t.lesson} ${extra}` : t.lesson,
    redacted: true,
  };
}

export async function requestLearning(id: string, actor: Actor, lesson?: string) {
  const v = await getCase(id);
  needRole(actor, ['manager'], 'Only a manager can share a learning card.');
  if (v.learning.state === 'pending' || v.learning.state === 'approved') {
    throw new AppError(409, 'A learning card was already requested for this case.');
  }
  const card = buildLearningCard(v, lesson);
  await appendEvents(id, [{ type: 'learning.requested', actor, data: { card } }]);
}

export async function decideLearning(id: string, actor: Actor, approve: boolean) {
  const v = await getCase(id);
  needRole(actor, ['manager'], 'Only a manager can approve a learning card.');
  if (v.learning.state !== 'pending') throw new AppError(409, 'No learning card is waiting for approval.');
  await appendEvents(id, [{ type: approve ? 'learning.approved' : 'learning.rejected', actor, data: {} }]);
}

export async function approvedLearningCards(): Promise<LearningCard[]> {
  const all = await listCases();
  const cards: LearningCard[] = [];
  for (const s of all) {
    const v = await getCase(s.id);
    if (v.learning.state === 'approved' && v.learning.card) cards.push(v.learning.card);
  }
  return cards;
}

/** Fictional example cards from the fixtures, shown on the Learning page and labelled as demo examples. */
export function seededLearningCards(): { id: string; summary: string }[] {
  return loadFixtures().knowledgeCards;
}
