'use client';
import { useRouter } from 'next/navigation';
import type { Actor } from '@/lib/types';
import { Info } from './ui';

export function ActorSwitch({ actors, current }: { actors: Actor[]; current: string }) {
  const router = useRouter();
  async function pick(id: string) {
    await fetch('/api/actor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <label className="small muted" htmlFor="actor">Acting as</label>
      <select id="actor" className="field" style={{ width: 'auto', minHeight: 36, maxWidth: '100%', minWidth: 0 }} value={current} onChange={(e) => pick(e.target.value)}>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.selfDeclared ? 'self-declared helper' : a.role})
          </option>
        ))}
      </select>
      <Info text="Demo only: there is no sign-in. Choose who you are acting as. Every action is recorded under that name." />
    </div>
  );
}
