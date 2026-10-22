/** Phrases that would claim safety or approval. AI text containing any of them is rejected. */
const UNSAFE = /(safe to (serve|eat|use|consume|sell)|is safe\b|are safe\b|no risk\b|nothing to worry|fine to serve|approved for (service|sale)|cleared for service|guarantee)/i;

export function containsUnsafeClaim(text: string): boolean {
  return UNSAFE.test(text);
}

/** Removes contact details and any given names from text that might be shared beyond the venue. */
export function redactText(text: string, names: string[] = []): string {
  let out = text;
  out = out.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email removed]');
  out = out.replace(/https?:\/\/\S+/gi, '[link removed]');
  out = out.replace(/(\+?\d[\d\s().-]{6,}\d)/g, '[number removed]');
  for (const n of names) {
    const clean = n.trim();
    if (clean.length < 2) continue;
    const esc = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\w])${esc}(?![\\w])`, 'gi'), '[name removed]');
  }
  return out.trim();
}

export function clean(value: unknown, max = 200): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max);
}
