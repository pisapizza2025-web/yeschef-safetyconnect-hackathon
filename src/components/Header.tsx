import Link from 'next/link';
import { currentActor } from '@/lib/request';
import { demoActors } from '@/lib/fixtures';
import { ActorSwitch } from './ActorSwitch';
import { Chip } from './ui';

export async function Header({ active }: { active: 'cases' | 'report' | 'learning' }) {
  const actor = await currentActor();
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="brand">
          <span className="brand-mark">SC</span>
          Yes Chef SafetyConnect
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/" aria-current={active === 'cases' ? 'page' : undefined}>Cases</Link>
          <Link href="/report" aria-current={active === 'report' ? 'page' : undefined}>Report Issue</Link>
          <Link href="/learning" aria-current={active === 'learning' ? 'page' : undefined}>Learning</Link>
        </nav>
        <span className="spacer" />
        <Chip tone="amber">Demo data</Chip>
        <ActorSwitch actors={demoActors()} current={actor.id} />
      </div>
    </header>
  );
}
