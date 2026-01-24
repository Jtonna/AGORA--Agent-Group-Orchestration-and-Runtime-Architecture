import type { Email, NewEmail, Agent } from '../types/email.js';

const API_BASE = 'http://localhost:60061';

export interface EmailWithThread {
  email: Email;
  thread: Email[];
}

export interface DirectoryAgent {
  name: string;
  pid: number | null;
  supervisor: string | null;
}

export async function getAgents(): Promise<Agent[]> {
  try {
    const response = await fetch(`${API_BASE}/directory/agents`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return (data.agents || []).map((a: DirectoryAgent) => ({
      name: a.name,
      supervisor: a.supervisor,
      pid: a.pid,
    }));
  } catch {
    return [];
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getInbox(viewer: string): Promise<Email[]> {
  try {
    const response = await fetch(`${API_BASE}/mail?viewer=${viewer}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getEmail(id: string, viewer: string): Promise<EmailWithThread | null> {
  try {
    const response = await fetch(`${API_BASE}/mail/${id}?viewer=${viewer}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      email: data.email,
      thread: data.thread || [],
    };
  } catch {
    return null;
  }
}

export async function sendEmail(email: NewEmail): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/mail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getInvestigation(viewer: string): Promise<Email[]> {
  try {
    const response = await fetch(`${API_BASE}/investigation/${viewer}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}
