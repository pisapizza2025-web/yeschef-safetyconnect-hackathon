import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Actor, ExternalResearch, Fixtures, Scenario, ScenarioType } from './types';

/**
 * Accepts the plan's shape and the richer Grok Bot file shape:
 *  - site `label` or `name`
 *  - helpers under `helpers` or `communityHelpers`, with `name` or `displayName`
 *  - supplier `source` or `sourceLabel`
 *  - limits from `sites[].settings` or from the procedure `config`
 * Keys the app does not read (meta, assets, seeded messages, ...) are ignored.
 */

const SiteS = z.object({
  id: z.string(),
  label: z.string().optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  settings: z.object({ fridgeMaxC: z.number().optional(), cookingMinC: z.number().optional() }).optional(),
});
const ProcedureS = z.object({
  siteId: z.string(),
  category: z.string(),
  title: z.string(),
  version: z.string(),
  body: z.string(),
  sourceLabel: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});
const SupplierS = z.object({
  siteId: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  serviceTags: z.array(z.string()).default([]),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  isFictional: z.boolean().optional(),
  source: z.string().optional(),
  sourceLabel: z.string().optional(),
});
const RecordSlotS = z.object({
  slot: z.number().optional(),
  status: z.string().optional(),
  item: z.string().nullable().optional(),
  readingC: z.number().nullable().optional(),
  recordedAt: z.string().nullable().optional(),
  recordedBy: z.string().nullable().optional(),
});
const ScenarioS = z.object({
  type: z.enum(['fridge', 'allergen', 'cooking', 'records']),
  title: z.string(),
  description: z.string().optional(),
  reportedFacts: z.array(z.string()).optional(),
  starter: z.record(z.unknown()).optional(),
  records: z.array(RecordSlotS).optional(),
});
const HelperS = z.object({
  id: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  note: z.string().optional(),
  credentialsStatus: z.string().optional(),
  availabilityLabel: z.string().optional(),
});
const CardS = z.object({ id: z.string(), summary: z.string(), optIn: z.boolean().optional(), redacted: z.boolean().optional() });
const FixturesS = z.object({
  sites: z.array(SiteS).min(1),
  procedures: z.array(ProcedureS).default([]),
  suppliers: z.array(SupplierS).default([]),
  scenarios: z.array(ScenarioS).default([]),
  helpers: z.array(HelperS).optional(),
  communityHelpers: z.array(HelperS).optional(),
  knowledgeCards: z.array(CardS).default([]),
});

// Links from the file become hrefs, so only http(s) is accepted.
const httpUrl = z.string().refine((u) => /^https?:\/\//i.test(u), 'must start with http:// or https://');
const ExternalProviderS = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  relevanceReason: z.string().optional(),
  citation: z.object({ label: z.string(), uri: httpUrl }),
  sourceQuote: z.string().optional(),
  contact: z.object({ website: httpUrl.optional(), phone: z.string().optional(), email: z.string().optional() }).optional(),
  contactNote: z.string().optional(),
});
const ExternalS = z.object({
  meta: z.object({ note: z.string().optional(), retrievedAt: z.string().optional(), siteId: z.string().optional(), category: z.string().optional() }).partial().optional(),
  results: z.array(ExternalProviderS).default([]),
});

let cached: Fixtures | null = null;

export function fixturesPath(): string {
  return process.env.FIXTURES_FILE || path.join(process.cwd(), 'data', 'demo-fixtures.json');
}
export function externalPath(): string {
  return process.env.EXTERNAL_PROVIDERS_FILE || path.join(path.dirname(fixturesPath()), 'external-providers.json');
}

function londonHm(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Starter values for the report form: taken from the file, or read from the scenario text. */
function deriveStarter(type: ScenarioType, s: z.infer<typeof ScenarioS>, requiredPerDay?: number): Record<string, unknown> {
  if (s.starter) return s.starter;
  const facts = s.reportedFacts ?? [];
  const degrees = (txt: string) => {
    const m = /(-?\d+(?:\.\d+)?)\s*°\s*C/i.exec(txt);
    return m ? Number(m[1]) : undefined;
  };
  const fromFacts = (): number | undefined => {
    for (const f of facts) {
      const v = degrees(f);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  switch (type) {
    case 'fridge':
      return {
        reading: fromFacts() ?? degrees(s.title) ?? '',
        exposure: facts.some((f) => /exposure.*unknown/i.test(f)) ? 'unknown' : '',
      };
    case 'cooking':
      return { reading: fromFacts() ?? '', item: '' };
    case 'allergen':
      return { product: '', note: facts.slice(0, 2).join('; ') };
    case 'records': {
      const slots = s.records ?? [];
      const recorded = slots.filter((x) => String(x.status ?? '').toLowerCase() === 'recorded');
      return {
        required: slots.length || requiredPerDay || 4,
        entries: recorded.map((x) => ({
          time: londonHm(x.recordedAt),
          value: x.readingC == null ? '' : String(x.readingC),
          loggedBy: x.recordedBy ?? '',
          item: x.item ?? '',
        })),
      };
    }
  }
}

function loadExternal(): ExternalResearch | null {
  const p = externalPath();
  if (!existsSync(p)) return null;
  const parsed = ExternalS.parse(JSON.parse(readFileSync(p, 'utf8')));
  const providers = parsed.results
    .filter((r) => r.source === 'external_business')
    .map((r) => ({
      id: r.id,
      title: r.title,
      relevanceReason: r.relevanceReason ?? '',
      citation: r.citation,
      sourceQuote: r.sourceQuote,
      contact: r.contact ?? {},
      contactNote: r.contactNote,
    }));
  const links = parsed.results
    .filter((r) => r.source === 'external_search_link')
    .map((r) => ({ id: r.id, title: r.title, uri: r.citation.uri }));
  if (!providers.length && !links.length) return null;
  return {
    retrievedAt: parsed.meta?.retrievedAt ?? '',
    note: parsed.meta?.note ?? '',
    siteId: parsed.meta?.siteId,
    category: parsed.meta?.category,
    providers,
    links,
  };
}

export function loadFixtures(force = false): Fixtures {
  if (cached && !force) return cached;
  const p = fixturesPath();
  if (!existsSync(p)) throw new Error(`Fixtures file not found: ${p}`);
  const raw = FixturesS.parse(JSON.parse(readFileSync(p, 'utf8')));

  const recordsProc = raw.procedures.find((x) => x.category === 'records' && typeof x.config?.requiredCookingRecordsPerDay === 'number');
  const requiredPerDay = recordsProc?.config?.requiredCookingRecordsPerDay as number | undefined;

  cached = {
    sites: raw.sites.map((s) => ({
      id: s.id,
      label: s.label ?? s.name ?? s.id,
      city: s.city,
      country: s.country,
      timezone: s.timezone,
      settings: s.settings,
    })),
    procedures: raw.procedures,
    suppliers: raw.suppliers.map((s) => ({
      siteId: s.siteId,
      name: s.name ?? s.displayName ?? 'Unnamed supplier',
      serviceTags: s.serviceTags,
      phone: s.phone ?? null,
      email: s.email ?? null,
      isFictional: s.isFictional,
      source: s.source ?? s.sourceLabel,
    })),
    scenarios: raw.scenarios.map((s): Scenario => ({
      type: s.type,
      title: s.title,
      description: s.description,
      reportedFacts: s.reportedFacts,
      starter: deriveStarter(s.type, s, requiredPerDay),
    })),
    helpers: (raw.helpers ?? raw.communityHelpers ?? []).map((h) => ({
      id: h.id,
      name: h.name ?? h.displayName ?? h.id,
      note: h.note ?? [h.credentialsStatus, h.availabilityLabel].filter(Boolean).join('; '),
    })),
    knowledgeCards: raw.knowledgeCards.filter((c) => c.optIn !== false && c.redacted !== false).map((c) => ({ id: c.id, summary: c.summary })),
    external: loadExternal(),
  };
  return cached;
}

/** Demo actors. There is no authentication: the person at the screen picks who they are acting as. */
export function demoActors(): Actor[] {
  const f = loadFixtures();
  const helpers: Actor[] = f.helpers.map((h) => ({ id: h.id, name: h.name, role: 'helper', selfDeclared: true }));
  return [
    { id: 'demo-manager', name: 'Demo Manager', role: 'manager' },
    { id: 'demo-chef', name: 'Demo Chef', role: 'staff' },
    ...helpers,
  ];
}

export function defaultActor(): Actor {
  return demoActors()[0];
}

export function findActor(id: string | undefined | null): Actor {
  return demoActors().find((a) => a.id === id) ?? defaultActor();
}

export const DEFAULT_SETTINGS = { fridgeMaxC: 8, cookingMinC: 75 };

/** Site limits: explicit site settings first, then the site's own procedure config, then labelled demo defaults. */
export function siteSettings(siteId: string): { fridgeMaxC: number; cookingMinC: number; isDefault: boolean } {
  const f = loadFixtures();
  const site = f.sites.find((s) => s.id === siteId);
  const procConfig = (category: string) => f.procedures.find((p) => p.siteId === siteId && p.category === category)?.config ?? {};
  const asNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const fridge = site?.settings?.fridgeMaxC ?? asNum(procConfig('fridge').fridgeMaxC);
  const cooking = site?.settings?.cookingMinC ?? asNum(procConfig('cooking').cookingCoreMinC) ?? asNum(procConfig('cooking').cookingMinC);
  return {
    fridgeMaxC: fridge ?? DEFAULT_SETTINGS.fridgeMaxC,
    cookingMinC: cooking ?? DEFAULT_SETTINGS.cookingMinC,
    isDefault: fridge === undefined || cooking === undefined,
  };
}
