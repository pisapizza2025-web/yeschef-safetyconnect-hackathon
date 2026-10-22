import { Header } from '@/components/Header';
import { Chip, Info } from '@/components/ui';
import { approvedLearningCards, seededLearningCards } from '@/lib/cases';

export const dynamic = 'force-dynamic';

export default async function LearningPage() {
  const cards = await approvedLearningCards();
  const examples = seededLearningCards();
  return (
    <>
      <Header active="learning" />
      <main className="main">
        <div className="head">
          <div className="row">
            <h1>Learning</h1>
            <Info text="Only cards a manager has approved appear here. Venue names, people, suppliers, contact details and case notes are removed. Nothing is shared automatically." />
          </div>
        </div>
        {cards.length === 0 && examples.length === 0 && <div className="card"><p className="muted">No approved learning cards yet.</p></div>}
        <div className="grid-4">
          {examples.map((c) => (
            <article className="card" key={c.id}>
              <div className="card-head"><h2>Example learning card</h2><Chip tone="grey">Demo example (fictional)</Chip></div>
              <p>{c.summary}</p>
              <p className="small muted">Redacted: no venue, people or contact details.</p>
            </article>
          ))}
          {cards.map((c) => (
            <article className="card" key={c.id}>
              <div className="card-head"><h2>{c.title}</h2><Chip tone="green">Approved</Chip></div>
              <p>{c.whatHappened}</p>
              {c.whatHelped.length > 0 && (
                <div>
                  <div className="small muted">What helped</div>
                  <ul className="ul">{c.whatHelped.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
              )}
              <p><strong>Lesson:</strong> {c.lesson}</p>
              <p className="small muted">Redacted: no venue, people or contact details.</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
