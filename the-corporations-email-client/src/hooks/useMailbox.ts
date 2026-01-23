import { useState, useEffect, useCallback } from 'react';
import { getInbox, checkHealth, sendEmail as apiSendEmail } from '../api/mailbox.js';
import type { Email, AgentStats, AgentStatus, NewEmail, AGENTS } from '../types/email.js';

function determineStatus(latestSubject?: string): AgentStatus {
  if (!latestSubject) return 'unknown';

  if (latestSubject.startsWith('BLOCKED:') || latestSubject.startsWith('QUESTION:')) {
    return 'blocked';
  }
  if (
    latestSubject.startsWith('PROGRESS:') ||
    latestSubject.startsWith('COMPLETE:') ||
    latestSubject.startsWith('GETTING STARTED:')
  ) {
    return 'active';
  }
  return 'waiting';
}

export function useMailbox(agents: typeof AGENTS) {
  const [apiConnected, setApiConnected] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [activityFeed, setActivityFeed] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    const isConnected = await checkHealth();
    setApiConnected(isConnected);

    if (!isConnected) {
      setLoading(false);
      return;
    }

    const stats: AgentStats[] = [];
    let allEmails: Email[] = [];

    for (const agent of agents) {
      const allMail = await getInbox(agent.name);
      const sent = allMail.filter((e) => e.from.toLowerCase() === agent.name.toLowerCase());
      const received = allMail.filter((e) =>
        e.to.some((t) => t.toLowerCase() === agent.name.toLowerCase())
      );
      const unread = received.filter((e) => !e.read);
      const latestReceived = received[0]?.subject;

      stats.push({
        name: agent.name,
        role: agent.role,
        sentCount: sent.length,
        receivedCount: received.length,
        unreadCount: unread.length,
        status: determineStatus(latestReceived),
        latestSubject: latestReceived,
      });

      allEmails = [...allEmails, ...allMail];
    }

    setAgentStats(stats);

    // Sort by timestamp descending and dedupe by id
    const seen = new Set<string>();
    const uniqueEmails = allEmails
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .slice(0, 20);

    setActivityFeed(uniqueEmails);
    setLastRefresh(new Date());
    setLoading(false);
  }, [agents]);

  const sendEmail = useCallback(async (email: NewEmail): Promise<boolean> => {
    const success = await apiSendEmail(email);
    if (success) {
      await refresh();
    }
    return success;
  }, [refresh]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    apiConnected,
    agentStats,
    activityFeed,
    loading,
    lastRefresh,
    refresh,
    sendEmail,
  };
}

export function useAgentInbox(agentName: string | null) {
  const [inbox, setInbox] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!agentName) return;
    setLoading(true);
    const emails = await getInbox(agentName);
    setInbox(emails);
    setLoading(false);
  }, [agentName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { inbox, loading, refresh };
}
