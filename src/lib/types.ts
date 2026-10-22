export type ScenarioType = 'fridge' | 'allergen' | 'cooking' | 'records';
export const SCENARIO_TYPES: ScenarioType[] = ['fridge', 'allergen', 'cooking', 'records'];

export type Role = 'manager' | 'staff' | 'helper';

export interface Actor {
  id: string;
  name: string;
  role: Role;
  /** Community helpers declare themselves; nothing is verified. */
  selfDeclared?: boolean;
}

export type EventType =
  | 'case.created'
  | 'source.internal'
  | 'source.external'
  | 'assessment.recorded'
  | 'action.recorded'
  | 'recheck.recorded'
  | 'message.added'
  | 'handoff.opened'
  | 'case.closed'
  | 'case.reopened'
  | 'learning.requested'
  | 'learning.approved'
  | 'learning.rejected';

export interface EventRecord {
  seq: number;
  id: string;
  caseId: string;
  type: EventType;
  at: string; // ISO timestamp
  actor: Actor;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface Site {
  id: string;
  label: string;
  city?: string;
  country?: string;
  timezone?: string;
  settings?: { fridgeMaxC?: number; cookingMinC?: number };
}

export interface Procedure {
  siteId: string;
  category: string;
  title: string;
  version: string;
  body: string;
  sourceLabel?: string;
  /** Site-configured demo values, for example fridgeMaxC or cookingCoreMinC. */
  config?: Record<string, unknown>;
}

export interface Supplier {
  siteId: string;
  name: string;
  serviceTags: string[];
  phone?: string | null;
  email?: string | null;
  isFictional?: boolean;
  source?: string;
}

export interface Scenario {
  type: ScenarioType;
  title: string;
  description?: string;
  reportedFacts?: string[];
  /** Prefilled report-form values: given in the file, or derived from the scenario text. */
  starter: Record<string, unknown>;
}

export interface Helper {
  id: string;
  name: string;
  role?: string;
  note?: string;
}

export interface KnowledgeCard {
  id: string;
  summary: string;
}

/** One entry of the external research file. Businesses are real; nothing about them is confirmed. */
export interface ExternalProvider {
  id: string;
  title: string;
  relevanceReason: string;
  citation: { label: string; uri: string };
  sourceQuote?: string;
  contact: { website?: string; phone?: string; email?: string };
  contactNote?: string;
}
export interface ExternalLink {
  id: string;
  title: string;
  uri: string;
}
export interface ExternalResearch {
  retrievedAt: string;
  note: string;
  siteId?: string;
  category?: string;
  providers: ExternalProvider[];
  links: ExternalLink[];
}

export interface Fixtures {
  sites: Site[];
  procedures: Procedure[];
  suppliers: Supplier[];
  scenarios: Scenario[];
  helpers: Helper[];
  knowledgeCards: KnowledgeCard[];
  external: ExternalResearch | null;
}

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
