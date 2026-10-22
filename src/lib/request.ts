import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AppError, type Actor } from './types';
import { findActor } from './fixtures';

export const ACTOR_COOKIE = 'sc_actor';

/** Demo only: the person at the screen picks who they act as. There is no authentication. */
export async function currentActor(): Promise<Actor> {
  const jar = await cookies();
  return findActor(jar.get(ACTOR_COOKIE)?.value);
}

export function fail(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
