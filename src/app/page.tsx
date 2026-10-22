import Link from 'next/link';
import { Header } from '@/components/Header';
import { FlagChip, StatusChip } from '@/components/badges';
import { ExpandList } from '@/components/ui';
import { listCases } from '@/lib/cases';
import { loadFixtures } from '@/lib/fixtures';
import { formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = loadFixtures();
  const all = await listCases();
  const site = f.sites.find((s) => s.id === sp.site)?.id;
  const cases = site ? all.filter((c) => c.siteId === site) : all;

  return (
    <>
      <Header active="cases" />
      <main className="main">
        <div className="head">
          <h1>Cases</h1>
          <Link className="btn" href="/report">Report Issue</Link>
        </div>

        <section className="stack" aria-label="Demo case starters">
          <div className="grid-4">
            {f.scenarios.map((s) => (
              <div className="card" key={s.type}>
                <h2>{s.title}</h2>
                {s.description && <p className="small">{s.description}</p>}
                <ul className="ul small muted">{(s.reportedFacts ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
                <div className="row">
                  {f.sites.map((st) => (
                    <Link key={st.id} className="btn ghost small" href={`/report?type=${s.type}&site=${st.id}`}>Start at {st.label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-label="Cases">
          <div className="card-head">
            <h2>Recent cases</h2>
            <div className="row">
              <Link className={`btn small ${site ? 'ghost' : ''}`} href="/">All sites</Link>
              {f.sites.map((s) => (
                <Link key={s.id} className={`btn small ${site === s.id ? '' : 'ghost'}`} href={`/?site=${s.id}`}>{s.label}</Link>
              ))}
            </div>
          </div>
          <ExpandList empty="No cases yet. Start one from a card above.">
            {cases.map((c) => (
              <Link className="list-row" key={c.id} href={`/cases/${c.id}`}>
                <span className="list-main">
                  <strong>{c.title}</strong>
                  <span className="small muted">{c.siteLabel} · {c.id} · {formatTime(c.createdAt)}</span>
                </span>
                {c.flag && <FlagChip flag={c.flag} />}
                <StatusChip status={c.status} />
              </Link>
            ))}
          </ExpandList>
        </section>
      </main>
    </>
  );
}
