import type { EventRecord } from './types';
import { ACTION_LABELS, type ActionCategory } from './rules';

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

export function roleLabel(a: { role: string; selfDeclared?: boolean }): string {
  if (a.selfDeclared) return 'self-declared helper';
  return a.role;
}

/** One plain sentence per event for the timeline. Never claims more than the event recorded. */
export function describeEvent(e: EventRecord): string {
  const d = e.data as Record<string, any>;
  switch (e.type) {
    case 'case.created':
      return `Case reported: ${d.title}`;
    case 'source.internal':
      return d.procedure
        ? `Internal source checked: site procedure "${d.procedure.title}" (${d.procedure.version})${d.suppliers?.length ? `, ${d.suppliers.length} known supplier on file` : ', no known supplier on file'}`
        : 'Internal source checked: no site procedure found';
    case 'source.external':
      return d.providers?.length
        ? `No matching supplier on file. ${d.providers.length} external options listed from a research snapshot, plus search links (nobody was contacted, availability not confirmed)`
        : 'No matching supplier on file. External web search handoff prepared (not a booking)';
    case 'assessment.recorded':
      return `Assessment (${d.mode === 'grok' ? 'live AI comment added' : 'demo rules'}): ${d.headline}`;
    case 'action.recorded':
      return `Action recorded [${ACTION_LABELS[d.category as ActionCategory] ?? 'Other action'}]: ${d.text}`;
    case 'recheck.recorded':
      return `Recheck recorded: ${d.value}°C (earlier readings kept)`;
    case 'message.added':
      return `Message: ${d.text}`;
    case 'handoff.opened':
      return `Link opened: ${d.label} (this does not confirm contact was made)`;
    case 'case.closed':
      return `Case closed${d.note ? `: ${d.note}` : ''}`;
    case 'case.reopened':
      return `Case reopened${d.note ? `: ${d.note}` : ''}`;
    case 'learning.requested':
      return 'Learning card requested (waiting for approval, nothing shared)';
    case 'learning.approved':
      return 'Learning card approved for the community';
    case 'learning.rejected':
      return 'Learning card rejected (not shared)';
  }
}
