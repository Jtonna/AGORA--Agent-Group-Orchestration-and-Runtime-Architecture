import { useState, useEffect, useCallback, useRef } from 'react';
import { getInbox, checkHealth, sendEmail as apiSendEmail, getAgents } from '../api/mailbox.js';
import type { Email, AgentStats, AgentStatus, NewEmail, Agent } from '../types/email.js';
import { CEO_AGENT } from '../types/email.js';
import { playNotificationSound } from '../utils/sound.js';

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

export function useMailbox(soundEnabled: boolean = true) {
  const [apiConnected, setApiConnected] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([CEO_AGENT]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [activityFeed, setActivityFeed] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const prevCeoUnreadIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  // Use ref to avoid recreating refresh callback when sound toggled
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const refresh = useCallback(async () => {
    setLoading(true);

    const isConnected = await checkHealth();
    setApiConnected(isConnected);

    if (!isConnected) {
      setLoading(false);
      return;
    }

    // Fetch agents dynamically from backend
    const backendAgents = await getAgents();
    // Filter out CEO if returned by backend (we add it statically)
    const filteredAgents = backendAgents.filter((a) => a.name.toLowerCase() !== 'ceo');
    // CEO first, then backend agents
    const allAgents = [CEO_AGENT, ...filteredAgents];
    setAgents(allAgents);

    const stats: AgentStats[] = [];
    let allEmails: Email[] = [];
    let ceoUnreadIds = new Set<string>();

    for (const agent of allAgents) {
      const allMail = await getInbox(agent.name);
      const sent = allMail.filter((e) => e.from.toLowerCase() === agent.name.toLowerCase());
      const received = allMail.filter((e) =>
        e.to.some((t) => t.toLowerCase() === agent.name.toLowerCase())
      );
      const unread = received.filter((e) => !e.read);
      const latestReceived = received[0]?.subject;

      // Track CEO's unread email IDs for sound notification
      if (agent.name.toLowerCase() === 'ceo') {
        ceoUnreadIds = new Set(unread.map((e) => e.id));
      }

      stats.push({
        name: agent.name,
        supervisor: agent.supervisor,
        sentCount: sent.length,
        receivedCount: received.length,
        unreadCount: unread.length,
        status: determineStatus(latestReceived),
        latestSubject: latestReceived,
      });

      allEmails = [...allEmails, ...allMail];
    }

    setAgentStats(stats);

    // Check if CEO has new unread emails by comparing IDs
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
    } else if (soundEnabledRef.current) {
      const hasNewUnread = [...ceoUnreadIds].some((id) => !prevCeoUnreadIds.current.has(id));
      if (hasNewUnread) {
        playNotificationSound();
      }
    }
    prevCeoUnreadIds.current = ceoUnreadIds;

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
  }, []);

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
    agents,
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
