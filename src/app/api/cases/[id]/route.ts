import { NextResponse } from 'next/server';
import { getCase } from '@/lib/cases';
import { fail } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ case: await getCase(id) });
  } catch (e) {
    return fail(e);
  }
}
