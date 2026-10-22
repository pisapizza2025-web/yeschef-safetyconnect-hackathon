import type { ScenarioType } from './types';
import { applyRules, type RuleResult, type Settings } from './rules';
import { containsUnsafeClaim } from './guards';

export interface Assessment {
  /** 'grok' only when a live call genuinely succeeded; otherwise 'rules'. */
  mode: 'grok' | 'rules';
  rules: RuleResult;
  ai?: { text: string; model: string };
  note: string;
}

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY) && Boolean(process.env.XAI_MODEL);
}

const SYSTEM =
  'You help a restaurant manager think through a food safety incident. Use only the facts given. ' +
  'Never invent facts, names, ingredients, phone numbers, prices or availability. ' +
  'Never say food is safe, approved or fine to serve. Reply in plain text, at most 70 words.';

async function callGrok(prompt: string): Promise<string> {
  const base = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.XAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI returned no text');
  return text;
}

/**
 * Rules always run and always decide the suggested actions.
 * Live AI, when genuinely configured and successful, only adds a labelled comment.
 */
export async function buildAssessment(
  type: ScenarioType,
  facts: Record<string, unknown>,
  settings: Settings,
  siteLabel: string,
): Promise<Assessment> {
  const rules = applyRules(type, facts, settings);
  if (!grokConfigured()) {
    return { mode: 'rules', rules, note: 'Rules-based assessment (demo rules). Live AI is not configured.' };
  }
  try {
    const prompt = `Incident type: ${type}. Site: ${siteLabel}. Reported facts: ${JSON.stringify(facts)}. Rule check: ${rules.headline}.`;
    const text = await callGrok(prompt);
    if (containsUnsafeClaim(text)) {
      return { mode: 'rules', rules, note: 'Rules-based assessment. The AI comment was rejected by the safety guard.' };
    }
    return { mode: 'grok', rules, ai: { text, model: String(process.env.XAI_MODEL) }, note: 'Rules-based actions with a live AI comment.' };
  } catch {
    return { mode: 'rules', rules, note: 'Rules-based assessment. Live AI was unavailable.' };
  }
}
