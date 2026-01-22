export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
  threadId?: string;
  replyTo?: string;
}

export interface InboxResponse {
  viewer: string;
  inbox: Email[];
}

export interface NewEmail {
  from: string;
  to: string[];
  subject: string;
  body: string;
  replyTo?: string;
}

export interface Agent {
  name: string;
  role: string;
}

export type AgentStatus = 'active' | 'waiting' | 'blocked' | 'unknown';

export interface AgentStats {
  name: string;
  role: string;
  inboxCount: number;
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

export const AGENTS: Agent[] = [
  { name: 'mike', role: 'Manager' },
  { name: 'jamie', role: 'Employee' },
  { name: 'justin', role: 'Tech Lead' },
];

export const SUBJECT_PREFIXES = [
  'GETTING STARTED:',
  'IMPORTANT:',
  'PROGRESS:',
  'COMPLETE:',
  'BLOCKED:',
  'QUESTION:',
  'APPROVED:',
  'REVISION:',
  'ACKNOWLEDGED:',
  'COLLABORATION:',
] as const;

export type SubjectPrefix = typeof SUBJECT_PREFIXES[number];
