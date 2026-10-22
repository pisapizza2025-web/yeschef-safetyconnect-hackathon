import { NextResponse } from 'next/server';
import { decideLearning, requestLearning } from '@/lib/cases';
import { AppError } from '@/lib/types';
import { currentActor, fail, readJson } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const actor = await currentActor();
    if (body.op === 'request') await requestLearning(id, actor, body.lesson ? String(body.lesson) : undefined);
    else if (body.op === 'approve') await decideLearning(id, actor, true);
    else if (body.op === 'reject') await decideLearning(id, actor, false);
    else throw new AppError(400, 'Unknown request.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
