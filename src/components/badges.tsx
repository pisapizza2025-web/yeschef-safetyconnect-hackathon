import type { Flag } from '@/lib/rules';
import { Chip } from './ui';

/** Colour follows the meaning of the label: shortfalls are red, completed or within-limit is green. */
export function FlagChip({ flag }: { flag: Flag }) {
  switch (flag) {
    case 'above_limit': return <Chip tone="red">Above site limit</Chip>;
    case 'below_limit': return <Chip tone="red">Below site limit</Chip>;
    case 'within_limit': return <Chip tone="green">Within site limit</Chip>;
    case 'unverified': return <Chip tone="red">Unverified</Chip>;
    case 'missing_records': return <Chip tone="red">Missing records</Chip>;
    case 'complete': return <Chip tone="green">Complete</Chip>;
  }
}

export function StatusChip({ status }: { status: 'Open' | 'Closed' }) {
  return status === 'Open' ? <Chip tone="red">Open</Chip> : <Chip tone="green">Closed</Chip>;
}
