import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Actor, EventRecord, EventType } from './types';

export const GENESIS = '0'.repeat(64);

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}
function dbFile(): string {
  return path.join(dataDir(), 'db.json');
}

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<EventRecord[]> {
  try {
    const raw = await fs.readFile(dbFile(), 'utf8');
    const parsed = JSON.parse(raw) as { events?: EventRecord[] };
    return parsed.events ?? [];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

async function writeAll(events: EventRecord[]): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${dbFile()}.tmp`;
  const body = JSON.stringify({ events }, null, 2);
  await fs.writeFile(tmp, body, 'utf8');
  try {
    await fs.rename(tmp, dbFile());
  } catch {
    // Some Windows setups refuse to rename over an existing file.
    await fs.writeFile(dbFile(), body, 'utf8');
    await fs.rm(tmp, { force: true });
  }
}

export function hashEvent(e: Omit<EventRecord, 'hash'>): string {
  const payload = JSON.stringify({
    seq: e.seq,
    id: e.id,
    caseId: e.caseId,
    type: e.type,
    at: e.at,
    actor: e.actor,
    data: e.data,
    prevHash: e.prevHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface NewEvent {
  type: EventType;
  actor: Actor;
  data: Record<string, unknown>;
}

/** Append-only: events are never updated or deleted. Each event carries the hash of the one before it. */
export function appendEvents(caseId: string, items: NewEvent[]): Promise<EventRecord[]> {
  return withLock(async () => {
    const all = await readAll();
    let prev = all.length ? all[all.length - 1].hash : GENESIS;
    let seq = all.length ? all[all.length - 1].seq : 0;
    const created: EventRecord[] = [];
    for (const item of items) {
      seq += 1;
      const base = {
        seq,
        id: crypto.randomUUID(),
        caseId,
        type: item.type,
        at: new Date().toISOString(),
        actor: item.actor,
        data: item.data,
        prevHash: prev,
      };
      const rec: EventRecord = { ...base, hash: hashEvent(base) };
      prev = rec.hash;
      created.push(rec);
    }
    await writeAll([...all, ...created]);
    return created;
  });
}

export async function listEvents(): Promise<EventRecord[]> {
  return readAll();
}

export async function eventsFor(caseId: string): Promise<EventRecord[]> {
  return (await readAll()).filter((e) => e.caseId === caseId);
}

export interface ChainStatus {
  ok: boolean;
  count: number;
  brokenAtSeq?: number;
}

export function verifyChain(events: EventRecord[]): ChainStatus {
  let prev = GENESIS;
  let expectedSeq = 0;
  for (const e of events) {
    expectedSeq += 1;
    const { hash, ...rest } = e;
    if (e.seq !== expectedSeq || e.prevHash !== prev || hashEvent(rest) !== hash) {
      return { ok: false, count: events.length, brokenAtSeq: e.seq };
    }
    prev = hash;
  }
  return { ok: true, count: events.length };
}

export async function chainStatus(): Promise<ChainStatus> {
  return verifyChain(await readAll());
}

/** Dev and test helper only. Not exposed through the API. */
export async function resetStore(): Promise<void> {
  await withLock(async () => {
    await fs.rm(dbFile(), { force: true });
  });
}
