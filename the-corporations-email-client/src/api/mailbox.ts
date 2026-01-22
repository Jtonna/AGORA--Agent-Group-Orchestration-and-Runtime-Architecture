import type { Email, InboxResponse, NewEmail } from '../types/email.js';

const API_BASE = 'http://localhost:60061';

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
    const data: InboxResponse = await response.json();
    return data.inbox || [];
  } catch {
    return [];
  }
}

export async function getEmail(id: string, viewer: string): Promise<Email | null> {
  try {
    const response = await fetch(`${API_BASE}/mail/${id}?viewer=${viewer}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
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
    return data.emails || [];
  } catch {
    return [];
  }
}
