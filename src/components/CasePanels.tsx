'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ACTION_LABELS, type ActionCategory, type Suggestion } from '@/lib/rules';
import type { LearningState } from '@/lib/cases';
import { Chip } from './ui';

async function post(url: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) return '';
  const data = await res.json().catch(() => ({}));
  return data.error || 'Something went wrong.';
}

function useSend(caseId: string) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(path: 'events' | 'learning', body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError('');
    const err = await post(`/api/cases/${caseId}/${path}`, body);
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    router.refresh();
    return true;
  }
  return { send, error, busy };
}

const Err = ({ text }: { text: string }) => (text ? <div className="err" role="alert">{text}</div> : null);

/** Suggested actions are only suggestions. Nothing is recorded until a person confirms. */
export function ActionPanel({ caseId, suggestions, canAct, closed }: { caseId: string; suggestions: Suggestion[]; canAct: boolean; closed: boolean }) {
  const { send, error, busy } = useSend(caseId);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ActionCategory>('other');
  if (!canAct) return <p className="small muted">Only venue staff can record actions. You can add a message below.</p>;
  return (
    <div className="form">
      {suggestions.length > 0 && (
        <div>
          <div className="small muted" style={{ marginBottom: 4 }}>Suggested (not done until you record it)</div>
          {suggestions.map((s, i) => (
            <div className="sugg" key={i}>
              <span>{s.text}</span>
              <button type="button" className="btn ghost small" disabled={closed} onClick={() => { setText(s.text); setCategory(s.category); }}>Use</button>
            </div>
          ))}
        </div>
      )}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send('events', { kind: 'action', text, category })) { setText(''); setCategory('other'); }
        }}
      >
        <label className="lbl">What was done
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} disabled={closed} />
        </label>
        <div className="row">
          <select className="field" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value as ActionCategory)} disabled={closed} aria-label="Action type">
            {(Object.keys(ACTION_LABELS) as ActionCategory[]).map((c) => <option key={c} value={c}>{ACTION_LABELS[c]}</option>)}
          </select>
          <button className="btn" type="submit" disabled={busy || closed || !text.trim()}>Record action</button>
        </div>
        <Err text={error} />
      </form>
    </div>
  );
}

export function MessageForm({ caseId, closed }: { caseId: string; closed: boolean }) {
  const { send, error, busy } = useSend(caseId);
  const [text, setText] = useState('');
  return (
    <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await send('events', { kind: 'message', text })) setText(''); }}>
      <textarea className="field" aria-label="Message" placeholder="Add a message to this case" value={text} onChange={(e) => setText(e.target.value)} disabled={closed} />
      <div className="row"><button className="btn" type="submit" disabled={busy || closed || !text.trim()}>Add message</button></div>
      <Err text={error} />
    </form>
  );
}

export function RecheckForm({ caseId, canAct, closed }: { caseId: string; canAct: boolean; closed: boolean }) {
  const { send, error, busy } = useSend(caseId);
  const [value, setValue] = useState('');
  if (!canAct) return null;
  return (
    <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await send('events', { kind: 'recheck', value })) setValue(''); }}>
      <input className="field num" style={{ width: 130 }} inputMode="decimal" aria-label="Recheck reading in °C" placeholder="Recheck °C" value={value} onChange={(e) => setValue(e.target.value)} disabled={closed} />
      <button className="btn" type="submit" disabled={busy || closed || !value.trim()}>Record recheck</button>
      <Err text={error} />
    </form>
  );
}

export function StatusButtons({ caseId, status, isManager }: { caseId: string; status: 'Open' | 'Closed'; isManager: boolean }) {
  const { send, error, busy } = useSend(caseId);
  const [note, setNote] = useState('');
  if (!isManager) return null;
  return (
    <div className="form">
      <div className="row">
        <input className="field" style={{ width: 260 }} aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {status === 'Open'
          ? <button className="btn ghost" disabled={busy} onClick={() => send('events', { kind: 'close', note }).then((ok) => ok && setNote(''))}>Close case</button>
          : <button className="btn" disabled={busy} onClick={() => send('events', { kind: 'reopen', note }).then((ok) => ok && setNote(''))}>Reopen case</button>}
      </div>
      <Err text={error} />
    </div>
  );
}

/** Opens a real link in a new tab and records only that it was opened. It never claims contact was made. */
export function HandoffLink({ caseId, href, label, target, canLog, children }: { caseId: string; href: string; label: string; target: 'tel' | 'mailto' | 'web'; canLog: boolean; children: ReactNode }) {
  return (
    <a
      className="btn ghost small"
      href={href}
      {...(target === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => {
        if (canLog) {
          fetch(`/api/cases/${caseId}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'handoff', target, label }), keepalive: true }).catch(() => undefined);
        }
      }}
    >
      {children}
    </a>
  );
}

export function LearningPanel({ caseId, state, isManager }: { caseId: string; state: LearningState; isManager: boolean }) {
  const { send, error, busy } = useSend(caseId);
  const [lesson, setLesson] = useState('');
  return (
    <div className="form">
      <div className="kv">
        <span className="small muted">Sharing status</span>
        {state === 'none' && <Chip tone="grey">Not shared</Chip>}
        {state === 'pending' && <Chip tone="amber">Pending approval</Chip>}
        {state === 'approved' && <Chip tone="green">Approved</Chip>}
        {state === 'rejected' && <Chip tone="grey">Rejected</Chip>}
      </div>
      {isManager && (state === 'none' || state === 'rejected') && (
        <div className="form">
          <label className="lbl">Optional lesson to add (names and contact details are removed)
            <input className="field" value={lesson} onChange={(e) => setLesson(e.target.value)} />
          </label>
          <div><button className="btn ghost" disabled={busy} onClick={() => send('learning', { op: 'request', lesson })}>Prepare learning card</button></div>
        </div>
      )}
      {isManager && state === 'pending' && (
        <div className="row">
          <button className="btn" disabled={busy} onClick={() => send('learning', { op: 'approve' })}>Approve for community</button>
          <button className="btn ghost" disabled={busy} onClick={() => send('learning', { op: 'reject' })}>Reject</button>
        </div>
      )}
      <Err text={error} />
    </div>
  );
}
