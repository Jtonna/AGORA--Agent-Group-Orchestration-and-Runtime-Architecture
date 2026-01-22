import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Dashboard } from './components/Dashboard.js';
import { EmailDetail } from './components/EmailDetail.js';
import { ComposeModal } from './components/ComposeModal.js';
import { StatusBar } from './components/StatusBar.js';
import { useMailbox, useAgentInbox } from './hooks/useMailbox.js';
import { AGENTS, type ViewType, type Email, type NewEmail } from './types/email.js';

export function App() {
  const { exit } = useApp();
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number | null>(null);
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [replyTo, setReplyTo] = useState<{ from: string; subject: string; id: string } | null>(null);

  const {
    apiConnected,
    agentStats,
    activityFeed,
    loading,
    lastRefresh,
    refresh,
    sendEmail,
  } = useMailbox(AGENTS);

  const selectedAgentName = selectedAgentIndex !== null ? AGENTS[selectedAgentIndex].name : null;
  const { inbox: agentInbox, refresh: refreshAgentInbox } = useAgentInbox(selectedAgentName);

  const handleSendEmail = useCallback(async (email: NewEmail): Promise<boolean> => {
    const success = await sendEmail(email);
    return success;
  }, [sendEmail]);

  const handleCancelCompose = useCallback(() => {
    setView('dashboard');
    setSelectedAgentIndex(null);
    setReplyTo(null);
  }, []);

  const handleReply = useCallback(() => {
    if (selectedEmail) {
      setReplyTo({
        from: selectedEmail.from,
        subject: selectedEmail.subject,
        id: selectedEmail.id,
      });
      setView('compose');
    }
  }, [selectedEmail]);

  useInput((input, key) => {
    // Global quit
    if (input.toLowerCase() === 'q' && view !== 'compose') {
      exit();
      return;
    }

    // Dashboard controls
    if (view === 'dashboard') {
      if (input === 'r' || input === 'R') {
        refresh();
      } else if (input >= '1' && input <= '4') {
        const agentIndex = parseInt(input, 10) - 1;
        if (agentIndex < AGENTS.length) {
          setSelectedAgentIndex(agentIndex);
          setSelectedEmailIndex(0);
          setView('agent-detail');
        }
      } else if (input.toLowerCase() === 'c') {
        setView('compose');
      }
    }

    // Agent detail controls
    else if (view === 'agent-detail') {
      if (input.toLowerCase() === 'b') {
        setView('dashboard');
        setSelectedAgentIndex(null);
      } else if (input === 'r' || input === 'R') {
        refreshAgentInbox();
      } else if (key.upArrow) {
        setSelectedEmailIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedEmailIndex((i) => Math.min(agentInbox.length - 1, i + 1));
      } else if (key.return && agentInbox[selectedEmailIndex]) {
        setSelectedEmail(agentInbox[selectedEmailIndex]);
        setView('email-detail');
      } else if (input.toLowerCase() === 'c') {
        setView('compose');
      }
    }

    // Email detail controls
    else if (view === 'email-detail') {
      if (input.toLowerCase() === 'b') {
        setView('agent-detail');
        setSelectedEmail(null);
      } else if (input.toLowerCase() === 'r') {
        handleReply();
      }
    }
  });

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor="cyan"
        justifyContent="center"
        paddingX={1}
      >
        <Text bold color="cyan">
          AGORA ORCHESTRATION DASHBOARD
        </Text>
      </Box>

      {/* Main Content Area */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {view === 'dashboard' && (
          <Dashboard
            agentStats={agentStats}
            activityFeed={activityFeed}
            selectedAgentIndex={selectedAgentIndex}
            onSelectAgent={setSelectedAgentIndex}
          />
        )}

        {view === 'agent-detail' && selectedAgentIndex !== null && (
          <Box flexDirection="column" flexGrow={1}>
            <Box marginBottom={1}>
              <Text bold color="cyan">
                AGENT: {AGENTS[selectedAgentIndex].name.toUpperCase()}
              </Text>
              <Text dimColor> - {AGENTS[selectedAgentIndex].role}</Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
              <Text>
                Inbox: {agentStats[selectedAgentIndex]?.inboxCount || 0} emails
                ({agentStats[selectedAgentIndex]?.unreadCount || 0} unread)
              </Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} flexGrow={1}>
              <Box marginBottom={1}><Text bold>INBOX CONTENTS</Text></Box>
              {agentInbox.length === 0 ? (
                <Text dimColor>(No emails in inbox)</Text>
              ) : (
                agentInbox.map((email, index) => {
                  const isSelected = index === selectedEmailIndex;
                  return (
                    <Box key={email.id}>
                      {isSelected && <Text color="cyan">{'> '}</Text>}
                      {!isSelected && <Text>{'  '}</Text>}
                      {!email.read && <Text color="yellow">* </Text>}
                      {email.read && <Text>  </Text>}
                      <Text dimColor>from </Text>
                      <Text bold>{email.from.padEnd(10)}</Text>
                      <Text> </Text>
                      <Text color={isSelected ? 'cyan' : 'white'}>
                        {email.subject.slice(0, 60)}
                        {email.subject.length > 60 ? '...' : ''}
                      </Text>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        )}

        {view === 'email-detail' && selectedEmail && (
          <EmailDetail
            email={selectedEmail}
            onBack={() => {
              setView('agent-detail');
              setSelectedEmail(null);
            }}
            onReply={handleReply}
          />
        )}

        {view === 'compose' && (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <ComposeModal
              onSend={handleSendEmail}
              onCancel={handleCancelCompose}
              replyTo={replyTo || undefined}
            />
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <StatusBar
        view={view}
        apiConnected={apiConnected}
        lastRefresh={lastRefresh}
        loading={loading}
      />
    </Box>
  );
}
