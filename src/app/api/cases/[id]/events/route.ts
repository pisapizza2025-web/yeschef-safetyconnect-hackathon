import { NextResponse } from 'next/server';
import { addAction, addMessage, addRecheck, closeCase, logHandoff, reopenCase } from '@/lib/cases';
import { AppError } from '@/lib/types';
import { currentActor, fail, readJson } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const actor = await currentActor();
    switch (body.kind) {
      case 'action':
        await addAction(id, actor, { text: String(body.text ?? ''), category: body.category ? String(body.category) : undefined });
        break;
      case 'message':
        await addMessage(id, actor, String(body.text ?? ''));
        break;
      case 'recheck':
        await addRecheck(id, actor, body.value);
        break;
      case 'handoff':
        await logHandoff(id, actor, { kind: String(body.target ?? 'web'), label: String(body.label ?? '') });
        break;
      case 'close':
        await closeCase(id, actor, body.note ? String(body.note) : undefined);
        break;
      case 'reopen':
        await reopenCase(id, actor, body.note ? String(body.note) : undefined);
        break;
      default:
        throw new AppError(400, 'Unknown request.');
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
