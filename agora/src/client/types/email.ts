export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
  threadId?: string;
  isResponseTo?: string;
}

export interface InboxResponse {
  viewer: string;
  inbox: Email[];
}

export interface NewEmail {
  from: string;
  to: string[];
  subject: string;
  content: string;
  isResponseTo?: string;
}

export interface Agent {
  name: string;
  supervisor?: string | null;
  pid?: number | null;
}

export type AgentStatus = 'active' | 'waiting' | 'blocked' | 'unknown';

export interface AgentStats {
  name: string;
  supervisor?: string | null;
  sentCount: number;
  receivedCount: number;
  unreadCount: number;
  status: AgentStatus;
  latestSubject?: string;
}

export type ViewType = 'dashboard' | 'agent-detail' | 'email-detail' | 'thread' | 'compose';

export interface AppState {
  view: ViewType;
  selectedAgent: string | null;
  selectedEmailId: string | null;
  composeData?: Partial<NewEmail>;
}

// CEO is a static entry - always shown first, not a registered backend agent
export const CEO_AGENT: Agent = { name: 'ceo', supervisor: null };
