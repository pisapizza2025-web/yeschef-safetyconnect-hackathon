import { NextResponse } from 'next/server';
import { grokConfigured } from '@/lib/assess';
import { loadFixtures } from '@/lib/fixtures';
import { chainStatus } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const f = loadFixtures();
  return NextResponse.json({
    ok: true,
    ai: grokConfigured() ? 'configured (live call attempted per case, falls back to rules on any failure)' : 'not configured (rules mode)',
    evidenceChain: await chainStatus(),
    fixtures: { sites: f.sites.length, procedures: f.procedures.length, suppliers: f.suppliers.length, scenarios: f.scenarios.length },
  });
}
