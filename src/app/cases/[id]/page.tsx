import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { FlagChip, StatusChip } from '@/components/badges';
import { ActionPanel, HandoffLink, LearningPanel, MessageForm, RecheckForm, StatusButtons } from '@/components/CasePanels';
import { Chip, ExpandList, Info } from '@/components/ui';
import { getCase, type CaseView } from '@/lib/cases';
import { describeEvent, formatTime, roleLabel } from '@/lib/format';
import { currentActor } from '@/lib/request';
import { chainStatus } from '@/lib/store';
import { ACTION_LABELS } from '@/lib/rules';
import { AppError } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Facts({ v }: { v: CaseView }) {
  const f = v.facts as Record<string, any>;
  const rows: [string, string][] = [['Site', v.siteLabel], ['Case', v.id], ['Reported by', `${v.createdBy.name} (${roleLabel(v.createdBy)}), ${formatTime(v.createdAt)}`]];
  if (v.type === 'fridge') rows.push(['Reading', `${f.reading}°C (site limit ${v.limit?.value}°C)`], ['Time above limit', String(f.exposure)]);
  if (v.type === 'cooking') rows.push(['Probe reading', `${f.reading}°C (site limit ${v.limit?.value}°C)`], ['Item', f.item || 'Not named in the report']);
  if (v.type === 'allergen') rows.push(['Product', f.product || 'Not named in the report'], ['What is known', f.note || 'Nothing recorded']);
  if (v.type === 'records') rows.push(['Records required', String(f.required)], ['Records present', String((f.entries as unknown[]).length)]);
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
      {rows.map(([k, val]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt className="small muted">{k}</dt>
          <dd style={{ margin: 0 }}>{val}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let v: CaseView;
  try {
    v = await getCase(id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const actor = await currentActor();
  const chain = await chainStatus();
  const isManager = actor.role === 'manager';
  const canAct = actor.role !== 'helper';
  const closed = v.status === 'Closed';
  const a = v.assessment;
  const entries = v.type === 'records' ? ((v.facts.entries as { time: string; value: string; loggedBy: string; item?: string }[]) ?? []) : [];
  const missing = v.type === 'records' ? Math.max(0, Number(v.facts.required) - entries.length) : 0;
  const events = [...v.events].reverse();

  return (
    <>
      <Header active="cases" />
      <main className="main">
        <div className="head">
          <div className="row">
            <h1>{v.title}</h1>
            <StatusChip status={v.status} />
            {a && <FlagChip flag={a.flag} />}
          </div>
        </div>

        <div className="grid-2">
          <div className="stack">
            <section className="card" aria-label="Report">
              <div className="card-head"><h2>Report</h2></div>
              <Facts v={v} />
            </section>

            {a && (
              <section className="card" aria-label="Assessment">
                <div className="card-head">
                  <div className="card-title">
                    <h2>Assessment</h2>
                    <Info text="Rules compare the report with this site's configured limits and suggest next steps. This app never decides whether food is safe. Suggestions only count once a person records them." />
                  </div>
                  {a.mode === 'grok' ? <Chip tone="blue">Live AI comment</Chip> : <Chip tone="grey">Demo rules</Chip>}
                </div>
                <p><strong>{a.headline}</strong></p>
                <ul className="ul">{a.cautions.map((c) => <li key={c}>{c}</li>)}</ul>
                {a.ai && (
                  <div className="source">
                    <div className="kv"><Chip tone="blue">AI comment</Chip><span className="small muted">{a.ai.model}. Check before acting.</span></div>
                    <p>{a.ai.text}</p>
                  </div>
                )}
                <p className="small muted">{a.note}</p>
              </section>
            )}

            <section className="card" aria-label="Sources">
              <div className="card-head">
                <div className="card-title">
                  <h2>Sources</h2>
                  <Info text="Internal sources are this site's own procedure and supplier list. If no supplier is on file, the only external option is a web search that opens in a new tab. Nothing is booked and no availability is claimed." />
                </div>
              </div>
              <div className="source">
                <div className="kv"><Chip tone="blue">Internal</Chip><strong>Site procedure</strong></div>
                {v.internal?.procedure ? (
                  <>
                    <div className="small muted">{v.internal.procedure.title} · {v.internal.procedure.version}{v.internal.procedure.sourceLabel ? ` · ${v.internal.procedure.sourceLabel}` : ''}</div>
                    <p>{v.internal.procedure.body}</p>
                  </>
                ) : (
                  <p className="muted">No procedure on file for this incident at this site.</p>
                )}
              </div>
              {v.internal?.suppliers.map((s) => (
                <div className="source" key={s.name}>
                  <div className="kv">
                    <Chip tone="blue">Internal</Chip>
                    <strong>{s.name}</strong>
                    {s.isFictional && <Chip tone="grey">Fictional demo supplier</Chip>}
                  </div>
                  <div className="small muted">{s.source}</div>
                  <div className="row">
                    {s.phone && <HandoffLink caseId={v.id} href={`tel:${s.phone}`} label={`Call ${s.name}`} target="tel" canLog={canAct}>Call</HandoffLink>}
                    {s.email && <HandoffLink caseId={v.id} href={`mailto:${s.email}`} label={`Email ${s.name}`} target="mailto" canLog={canAct}>Email</HandoffLink>}
                    {!s.phone && !s.email && <span className="small muted">No contact details on file.</span>}
                  </div>
                </div>
              ))}
              {v.external && (
                <div className="source">
                  <div className="kv"><Chip tone="grey">External</Chip><strong>No supplier on file for this site</strong></div>
                  {v.external.providers.length > 0 && (
                    <>
                      <p className="small muted">
                        Research snapshot, {v.external.snapshot?.retrievedAt ? `${formatTime(v.external.snapshot.retrievedAt)} London time` : 'time not recorded'}. These are real businesses. Nobody has been contacted and availability is not confirmed. Contact details are copied from each provider's own website.
                      </p>
                      {v.external.providers.map((p) => (
                        <div className="source" key={p.id} style={{ background: '#fff' }}>
                          <strong>{p.title}</strong>
                          {p.relevanceReason && <p className="small">{p.relevanceReason}</p>}
                          {p.sourceQuote && <p className="small muted">Its website says: “{p.sourceQuote}”</p>}
                          <div className="small muted">
                            Source: <a href={p.citation.uri} target="_blank" rel="noopener noreferrer">{p.citation.label}</a>
                          </div>
                          <div className="row">
                            {p.contact.phone && (
                              <HandoffLink caseId={v.id} href={`tel:${p.contact.phone.replace(/\s+/g, '')}`} label={`Call ${p.title}`} target="tel" canLog={canAct}>Call {p.contact.phone}</HandoffLink>
                            )}
                            {p.contact.email && (
                              <HandoffLink caseId={v.id} href={`mailto:${p.contact.email}`} label={`Email ${p.title}`} target="mailto" canLog={canAct}>Email {p.contact.email}</HandoffLink>
                            )}
                            {p.contact.website && (
                              <HandoffLink caseId={v.id} href={p.contact.website} label={`Website ${p.title}`} target="web" canLog={canAct}>Website</HandoffLink>
                            )}
                          </div>
                          {p.contactNote && <p className="small muted">Research note: {p.contactNote}</p>}
                        </div>
                      ))}
                    </>
                  )}
                  <p className="small muted">{v.external.providers.length > 0 ? 'Or search yourself. ' : ''}Opens a web search in a new tab. Availability, prices and contact details are not known, and nothing is booked.</p>
                  <div className="row">
                    {v.external.links.map((l) => (
                      <HandoffLink key={l.url} caseId={v.id} href={l.url} label={`Find a provider (${l.label.toLowerCase()})`} target="web" canLog={canAct}>
                        Find a provider ({l.label.toLowerCase()})
                      </HandoffLink>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {v.limit && (
              <section className="card" aria-label="Readings">
                <div className="card-head">
                  <div className="card-title">
                    <h2>Readings</h2>
                    <Info text="Every reading stays on record. A recheck is added as a new reading and never replaces the first one." />
                  </div>
                </div>
                <ExpandList empty="No readings.">
                  {v.readings.map((r) => (
                    <div className="list-row" key={r.id}>
                      <span className="list-main">
                        <strong className="num">{r.value}°C</strong>
                        <span className="small muted">{r.kind === 'first' ? 'First reading' : 'Recheck'} · {r.actor.name} · {formatTime(r.at)}</span>
                      </span>
                      <Chip tone={r.ok ? 'green' : 'red'}>{r.label}</Chip>
                    </div>
                  ))}
                </ExpandList>
                <RecheckForm caseId={v.id} canAct={canAct} closed={closed} />
              </section>
            )}

            {v.type === 'records' && (
              <section className="card" aria-label="Records">
                <div className="card-head">
                  <div className="card-title">
                    <h2>Records</h2>
                    <Info text="Rows show records that exist. Missing records have no labels because nothing is known about them." />
                  </div>
                </div>
                <ExpandList empty="No records.">
                  {[
                    ...entries.map((e, i) => (
                      <div className="list-row" key={`r${i}`}>
                        <span className="list-main">
                          <strong>Record {i + 1}</strong>
                          <span className="small muted">{[e.item, e.time, e.value && `value ${e.value}`, e.loggedBy && `by ${e.loggedBy}`].filter(Boolean).join(' · ') || 'No details entered'}</span>
                        </span>
                        <Chip tone="green">Recorded</Chip>
                      </div>
                    )),
                    ...Array.from({ length: missing }).map((_, i) => (
                      <div className="list-row" key={`m${i}`}>
                        <span className="list-main"><strong>Record {entries.length + i + 1}</strong></span>
                        <Chip tone="red">Missing</Chip>
                      </div>
                    )),
                  ]}
                </ExpandList>
              </section>
            )}

            <section className="card" aria-label="Actions">
              <div className="card-head">
                <div className="card-title">
                  <h2>Actions</h2>
                  <Info text="A person confirms every action by recording it. The app does not contact anyone or change anything on its own." />
                </div>
              </div>
              <ActionPanel caseId={v.id} suggestions={a?.items ?? []} canAct={canAct} closed={closed} />
              <ExpandList empty="No actions recorded yet.">
                {v.actions.map((x) => (
                  <div className="list-row" key={x.id}>
                    <span className="list-main">
                      <span>{x.text}</span>
                      <span className="small muted">{ACTION_LABELS[x.category]} · {x.actor.name} ({roleLabel(x.actor)}) · {formatTime(x.at)}</span>
                    </span>
                  </div>
                ))}
              </ExpandList>
            </section>

            <section className="card" aria-label="Messages">
              <div className="card-head">
                <div className="card-title">
                  <h2>Messages</h2>
                  <Info text="Anyone can comment. Helpers are self-declared and not verified. Messages are advice from people, not official guidance." />
                </div>
              </div>
              <ExpandList empty="No messages yet.">
                {v.messages.map((m) => (
                  <div className="list-row" key={m.id}>
                    <span className="list-main">
                      <span>{m.text}</span>
                      <span className="small muted">{m.actor.name} ({roleLabel(m.actor)}) · {formatTime(m.at)}</span>
                    </span>
                  </div>
                ))}
              </ExpandList>
              <MessageForm caseId={v.id} closed={closed} />
            </section>

            <section className="card" aria-label="Status">
              <div className="card-head"><h2>Status</h2><StatusChip status={v.status} /></div>
              {isManager ? <StatusButtons caseId={v.id} status={v.status} isManager={isManager} /> : <p className="small muted">Only a manager can close or reopen a case.</p>}
            </section>

            <section className="card" aria-label="Learning">
              <div className="card-head">
                <div className="card-title">
                  <h2>Learning</h2>
                  <Info text="Optional. A manager can turn this case into a redacted card for other venues. Nothing is shared until it is approved. Venue, people, suppliers, contact details and case notes are removed." />
                </div>
              </div>
              {v.learning.card && (
                <div className="source">
                  <strong>{v.learning.card.title}</strong>
                  <p>{v.learning.card.whatHappened}</p>
                  <p><strong>Lesson:</strong> {v.learning.card.lesson}</p>
                </div>
              )}
              <LearningPanel caseId={v.id} state={v.learning.state} isManager={isManager} />
            </section>
          </div>

          <aside className="col-sticky">
            <section className="card" aria-label="Timeline">
              <div className="card-head">
                <div className="card-title">
                  <h2>Timeline</h2>
                  <Info text="Every event is kept in order with who did it and when. Events are never edited or deleted. A hash chain shows whether the record was changed." />
                </div>
                {chain.ok ? <Chip tone="green">Chain verified</Chip> : <Chip tone="red">Chain broken</Chip>}
              </div>
              <ExpandList empty="No events.">
                {events.map((e) => (
                  <div className="tl-item" key={e.id}>
                    <span className="tl-dot" aria-hidden="true" />
                    <div>
                      <div>{describeEvent(e)}</div>
                      <div className="tl-meta">{e.actor.name} ({roleLabel(e.actor)}) · {formatTime(e.at)}</div>
                    </div>
                  </div>
                ))}
              </ExpandList>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
