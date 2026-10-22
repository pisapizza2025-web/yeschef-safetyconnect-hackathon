import { NextResponse } from 'next/server';
import { createCase, listCases } from '@/lib/cases';
import { currentActor, fail, readJson } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ cases: await listCases() });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const actor = await currentActor();
    const id = await createCase(
      { siteId: String(body.siteId ?? ''), type: String(body.type ?? ''), facts: (body.facts ?? {}) as Record<string, unknown> },
      actor,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
