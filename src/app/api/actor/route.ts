import { NextResponse } from 'next/server';
import { demoActors, findActor } from '@/lib/fixtures';
import { ACTOR_COOKIE, currentActor, readJson } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ actor: await currentActor(), actors: demoActors() });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const actor = findActor(String(body.id ?? ''));
  const res = NextResponse.json({ actor });
  res.cookies.set(ACTOR_COOKIE, actor.id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 });
  return res;
}
