import { Header } from '@/components/Header';
import { ReportForm } from '@/components/ReportForm';
import { Info } from '@/components/ui';
import { loadFixtures } from '@/lib/fixtures';
import { SCENARIO_TYPES, type ScenarioType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = loadFixtures();
  const type = (SCENARIO_TYPES.includes(sp.type as ScenarioType) ? sp.type : 'fridge') as ScenarioType;
  const site = f.sites.find((s) => s.id === sp.site)?.id ?? f.sites[0].id;
  const scenarios = SCENARIO_TYPES.map((t) => {
    const s = f.scenarios.find((x) => x.type === t);
    return { type: t, title: s?.title ?? t, starter: (s?.starter ?? {}) as Record<string, unknown> };
  });
  return (
    <>
      <Header active="report" />
      <main className="main">
        <div className="head">
          <div className="row">
            <h1>Report Issue</h1>
            <Info text="Starter values come from the demo data and can be changed. Only what you enter is recorded. Nothing is invented." />
          </div>
        </div>
        {/* key resets the form when the starter in the URL changes */}
        <ReportForm key={`${type}-${site}`} sites={f.sites.map((s) => ({ id: s.id, label: s.label }))} scenarios={scenarios} initialType={type} initialSite={site} />
      </main>
    </>
  );
}
