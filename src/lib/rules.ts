import type { ScenarioType } from './types';

export type ActionCategory =
  | 'escalate'
  | 'isolate_food'
  | 'contact_provider'
  | 'measure_again'
  | 'record_keeping'
  | 'supplier_confirmation'
  | 'other';

export const ACTION_LABELS: Record<ActionCategory, string> = {
  escalate: 'Escalated to manager',
  isolate_food: 'Food held back',
  contact_provider: 'Provider contacted',
  measure_again: 'Measured again',
  record_keeping: 'Records updated',
  supplier_confirmation: 'Supplier asked to confirm',
  other: 'Other action',
};

export interface Suggestion {
  text: string;
  category: ActionCategory;
}

export type Flag = 'above_limit' | 'below_limit' | 'within_limit' | 'unverified' | 'missing_records' | 'complete';

export interface RuleResult {
  flag: Flag;
  headline: string;
  items: Suggestion[];
  cautions: string[];
}

export interface Settings {
  fridgeMaxC: number;
  cookingMinC: number;
}

export function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Deterministic, labelled rules. These never declare food safe or approved. */
export function applyRules(type: ScenarioType, facts: Record<string, unknown>, s: Settings): RuleResult {
  switch (type) {
    case 'fridge': {
      const reading = num(facts.reading) ?? NaN;
      const exposure = String(facts.exposure ?? 'unknown');
      const cautions = ['This app does not decide whether food is safe.'];
      if (exposure.toLowerCase() === 'unknown') cautions.unshift('Exposure time is unknown: do not assume the food is safe.');
      if (reading > s.fridgeMaxC) {
        return {
          flag: 'above_limit',
          headline: `Reading ${reading}°C is above the site limit of ${s.fridgeMaxC}°C`,
          items: [
            { text: 'Tell the manager now', category: 'escalate' },
            { text: 'Separate potentially affected food and hold it until it has been assessed under the site procedure', category: 'isolate_food' },
            { text: 'Contact a refrigeration provider (site supplier or web search)', category: 'contact_provider' },
            { text: 'Record each reading and action here', category: 'record_keeping' },
          ],
          cautions,
        };
      }
      return {
        flag: 'within_limit',
        headline: `Reading ${reading}°C is within the site limit of ${s.fridgeMaxC}°C at the time of reading`,
        items: [{ text: 'Keep monitoring and record the next reading', category: 'record_keeping' }],
        cautions: ['A single reading does not show earlier exposure.', ...cautions],
      };
    }
    case 'allergen': {
      const named = String(facts.product ?? '').trim() !== '';
      return {
        flag: 'unverified',
        headline: 'Allergen information is unverified',
        items: [
          { text: 'Tell the manager', category: 'escalate' },
          { text: 'Ask the supplier to confirm the full ingredient and allergen list in writing', category: 'supplier_confirmation' },
          { text: 'Hold the product back from allergen-sensitive guests until it is confirmed', category: 'isolate_food' },
        ],
        cautions: [
          'Ingredients are not known. Do not assume the product is nut-free or safe.',
          ...(named ? [] : ['The product was not named in the report. No product details have been assumed.']),
        ],
      };
    }
    case 'cooking': {
      const reading = num(facts.reading) ?? NaN;
      if (reading < s.cookingMinC) {
        return {
          flag: 'below_limit',
          headline: `Reading ${reading}°C is below the site limit of ${s.cookingMinC}°C`,
          items: [
            { text: 'Keep cooking and measure again with a clean probe', category: 'measure_again' },
            { text: 'Record the recheck as a new reading; the first reading stays on record', category: 'record_keeping' },
            { text: 'Tell the manager if the recheck is still below the limit', category: 'escalate' },
          ],
          cautions: ['Hold the item until a recheck meets the site limit, as the site procedure requires.', 'This app does not decide whether food is safe.'],
        };
      }
      return {
        flag: 'within_limit',
        headline: `Reading ${reading}°C meets the site limit of ${s.cookingMinC}°C`,
        items: [{ text: 'Record the reading', category: 'record_keeping' }],
        cautions: ['This app does not decide whether food is safe.'],
      };
    }
    case 'records': {
      const required = num(facts.required) ?? 0;
      const entries = Array.isArray(facts.entries) ? facts.entries.length : 0;
      const missing = Math.max(0, required - entries);
      if (missing > 0) {
        return {
          flag: 'missing_records',
          headline: `${entries} of ${required} records present, ${missing} missing`,
          items: [
            { text: 'Tell the manager', category: 'escalate' },
            { text: 'Do not back-fill. Record that records are missing and complete the next record on time', category: 'record_keeping' },
          ],
          cautions: ['Missing records have no labels because nothing is known about them.'],
        };
      }
      return {
        flag: 'complete',
        headline: `${entries} of ${required} records present`,
        items: [],
        cautions: [],
      };
    }
  }
}

/** Reading check shared by the first reading and every recheck. */
export function readingOk(type: ScenarioType, value: number, limit: number): boolean {
  return type === 'fridge' ? value <= limit : value >= limit;
}

export function readingLabel(type: ScenarioType, value: number, limit: number): string {
  if (readingOk(type, value, limit)) return 'Within site limit';
  return type === 'fridge' ? 'Above site limit' : 'Below site limit';
}
