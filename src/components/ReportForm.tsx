'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ScenarioType } from '@/lib/types';

interface SiteOpt { id: string; label: string }
interface ScenarioOpt { type: ScenarioType; title: string; starter: Record<string, unknown> }
interface Entry { time: string; value: string; loggedBy: string; item: string }

const TYPE_LABEL: Record<ScenarioType, string> = {
  fridge: 'Fridge temperature',
  allergen: 'Allergen information',
  cooking: 'Cooking temperature',
  records: 'Missing records',
};

export function ReportForm({ sites, scenarios, initialType, initialSite }: { sites: SiteOpt[]; scenarios: ScenarioOpt[]; initialType: ScenarioType; initialSite: string }) {
  const router = useRouter();
  const starterOf = (t: ScenarioType) => scenarios.find((s) => s.type === t)?.starter ?? {};
  const [siteId, setSiteId] = useState(initialSite);
  const [type, setType] = useState<ScenarioType>(initialType);
  const s0 = starterOf(initialType) as Record<string, any>;
  const [reading, setReading] = useState(String(s0.reading ?? ''));
  const [exposure, setExposure] = useState(String(s0.exposure ?? 'unknown'));
  const [item, setItem] = useState(String(s0.item ?? ''));
  const [product, setProduct] = useState(String(s0.product ?? ''));
  const [note, setNote] = useState(String(s0.note ?? ''));
  const [required, setRequired] = useState(String(s0.required ?? '4'));
  const [entries, setEntries] = useState<Entry[]>(
    ((s0.entries as Entry[] | undefined) ?? []).map((e) => ({ time: e.time ?? '', value: e.value ?? '', loggedBy: e.loggedBy ?? '', item: e.item ?? '' })),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function changeType(t: ScenarioType) {
    const s = starterOf(t) as Record<string, any>;
    setType(t);
    setReading(String(s.reading ?? ''));
    setExposure(String(s.exposure ?? 'unknown'));
    setItem(String(s.item ?? ''));
    setProduct(String(s.product ?? ''));
    setNote(String(s.note ?? ''));
    setRequired(String(s.required ?? '4'));
    setEntries(((s.entries as Entry[] | undefined) ?? []).map((e) => ({ time: e.time ?? '', value: e.value ?? '', loggedBy: e.loggedBy ?? '', item: e.item ?? '' })));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const facts =
      type === 'fridge' ? { reading, exposure }
      : type === 'cooking' ? { reading, item }
      : type === 'allergen' ? { product, note }
      : { required, entries };
    const res = await fetch('/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ siteId, type, facts }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Could not save the case.');
    router.push(`/cases/${data.id}`);
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="lbl">Site
          <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="lbl">Incident
          <select className="field" value={type} onChange={(e) => changeType(e.target.value as ScenarioType)}>
            {(Object.keys(TYPE_LABEL) as ScenarioType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
      </div>

      {type === 'fridge' && (
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="lbl">Reading (°C)
            <input className="field num" inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} />
          </label>
          <label className="lbl">Time above limit
            <input className="field" value={exposure} onChange={(e) => setExposure(e.target.value)} />
          </label>
        </div>
      )}
      {type === 'cooking' && (
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="lbl">Probe reading (°C)
            <input className="field num" inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} />
          </label>
          <label className="lbl">Item (optional)
            <input className="field" value={item} onChange={(e) => setItem(e.target.value)} />
          </label>
        </div>
      )}
      {type === 'allergen' && (
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="lbl">Product (leave blank if unknown)
            <input className="field" value={product} onChange={(e) => setProduct(e.target.value)} />
          </label>
          <label className="lbl">What is known
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      )}
      {type === 'records' && (
        <div className="form">
          <label className="lbl" style={{ maxWidth: 240 }}>Records required
            <input className="field num" inputMode="numeric" value={required} onChange={(e) => setRequired(e.target.value)} />
          </label>
          <div className="form">
            <span className="small muted">Records actually present</span>
            {entries.map((en, i) => (
              <div className="row" key={i}>
                <input className="field" style={{ width: 180 }} placeholder="Item (optional)" value={en.item} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
                <input className="field" style={{ width: 110 }} placeholder="Time" value={en.time} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                <input className="field" style={{ width: 110 }} placeholder="Value" value={en.value} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <input className="field" style={{ width: 160 }} placeholder="Logged by" value={en.loggedBy} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, loggedBy: e.target.value } : x)))} />
                <button type="button" className="btn ghost small" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="btn ghost small" onClick={() => setEntries([...entries, { time: '', value: '', loggedBy: '', item: '' }])}>Add record</button></div>
          </div>
        </div>
      )}

      {error && <div className="err" role="alert">{error}</div>}
      <div className="row">
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving' : 'Submit report'}</button>
      </div>
    </form>
  );
}
