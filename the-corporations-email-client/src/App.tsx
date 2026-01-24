import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { Dashboard, MAX_VISIBLE_CARDS, type FocusedSection } from './components/Dashboard.js';
import { CARD_WIDTH } from './components/AgentCard.js';
import { EmailDetail } from './components/EmailDetail.js';
import { ComposeModal } from './components/ComposeModal.js';
import { StatusBar } from './components/StatusBar.js';
import { AgentListView } from './components/AgentListView.js';
import { useMailbox, useAgentInbox } from './hooks/useMailbox.js';
import { getEmail } from './api/mailbox.js';
import { calculateAllDepths } from './utils/hierarchyColors.js';
import type { ViewType, Email, NewEmail } from './types/email.js';

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Calculate cards per row based on terminal width
  const HIERARCHY_WIDTH = 27; // 26 width + 1 margin
  const terminalWidth = stdout.columns || 80;
  const availableWidth = terminalWidth - HIERARCHY_WIDTH;
  const cardsPerRow = Math.max(1, Math.floor(availableWidth / CARD_WIDTH));
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number | null>(null);
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailThread, setEmailThread] = useState<Email[]>([]);
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(0);
  const [previousView, setPreviousView] = useState<'dashboard' | 'agent-detail'>('dashboard');
  const [replyTo, setReplyTo] = useState<{ from: string; subject: string; id: string } | null>(null);

  // Two-level navigation states
  const [focusedSection, setFocusedSection] = useState<FocusedSection>('activity');
  const [interacting, setInteracting] = useState(false);
  const [showAgentList, setShowAgentList] = useState(false);
  const [agentListIndex, setAgentListIndex] = useState(0);
  const [agentListScrollOffset, setAgentListScrollOffset] = useState(0);
  const [hierarchyScrollOffset, setHierarchyScrollOffset] = useState(0);

  const {
    apiConnected,
    agents,
    agentStats,
    activityFeed,
    loading,
    lastRefresh,
    refresh,
    sendEmail,
  } = useMailbox();

  const selectedAgentName = selectedAgentIndex !== null ? agents[selectedAgentIndex]?.name : null;
  const { inbox: agentInbox, refresh: refreshAgentInbox } = useAgentInbox(selectedAgentName);

  // Calculate depths for agent list view
  const depths = useMemo(() => calculateAllDepths(agentStats), [agentStats]);

  // Max index for agent card navigation (including "+ more" card if present)
  const hasOverflow = agentStats.length > MAX_VISIBLE_CARDS;
  const maxCardIndex = hasOverflow ? MAX_VISIBLE_CARDS : agentStats.length - 1;

  const handleSendEmail = useCallback(async (email: NewEmail): Promise<boolean> => {
    const success = await sendEmail(email);
    return success;
  }, [sendEmail]);

  const handleCancelCompose = useCallback(() => {
    setView('dashboard');
    setSelectedAgentIndex(null);
    setFocusedSection('activity');
    setInteracting(false);
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

  const openAgentInbox = useCallback((index: number) => {
    if (index < agentStats.length) {
      setSelectedAgentIndex(index);
      setSelectedEmailIndex(0);
      setPreviousView('dashboard');
      setView('agent-detail');
      setFocusedSection('activity');
      setInteracting(false);
      setShowAgentList(false);
    }
  }, [agentStats.length]);

  useInput((input, key) => {
    // Global quit
    if (input.toLowerCase() === 'q' && view !== 'compose') {
      exit();
      return;
    }

    // Agent List View controls
    if (showAgentList) {
      if (key.escape) {
        setShowAgentList(false);
        setAgentListIndex(0);
        setAgentListScrollOffset(0);
      } else if (key.upArrow) {
        setAgentListIndex((i) => {
          const newIndex = Math.max(0, i - 1);
          // Scroll up if needed
          if (newIndex < agentListScrollOffset) {
            setAgentListScrollOffset(newIndex);
          }
          return newIndex;
        });
      } else if (key.downArrow) {
        setAgentListIndex((i) => {
          const newIndex = Math.min(agentStats.length - 1, i + 1);
          // Scroll down if needed
          if (newIndex >= agentListScrollOffset + 15) {
            setAgentListScrollOffset(newIndex - 14);
          }
          return newIndex;
        });
      } else if (key.return) {
        openAgentInbox(agentListIndex);
      }
      return;
    }

    // Dashboard controls - Two-level navigation
    if (view === 'dashboard') {
      // Global dashboard shortcuts
      if (input === 'r' || input === 'R') {
        refresh();
        return;
      } else if (input.toLowerCase() === 'c') {
        setView('compose');
        return;
      }

      // Escape: exit interacting mode or go back to activity
      if (key.escape) {
        if (interacting) {
          setInteracting(false);
          setSelectedAgentIndex(null);
        } else if (focusedSection !== 'activity') {
          setFocusedSection('activity');
        }
        return;
      }

      // When interacting within a section
      if (interacting) {
        if (focusedSection === 'hierarchy') {
          // Navigate within hierarchy tree
          if (key.upArrow) {
            setSelectedAgentIndex((i) => Math.max(0, (i ?? 0) - 1));
            // Auto-scroll hierarchy
            setHierarchyScrollOffset((offset) => {
              const newIndex = Math.max(0, (selectedAgentIndex ?? 0) - 1);
              if (newIndex < offset) return newIndex;
              return offset;
            });
          } else if (key.downArrow) {
            const currentIndex = selectedAgentIndex ?? 0;
            if (currentIndex >= agentStats.length - 1) {
              // At bottom - transition to activity
              setFocusedSection('activity');
              setInteracting(false);
              setSelectedAgentIndex(null);
            } else {
              setSelectedAgentIndex((i) => Math.min(agentStats.length - 1, (i ?? 0) + 1));
              // Auto-scroll hierarchy
              setHierarchyScrollOffset((offset) => {
                const newIndex = Math.min(agentStats.length - 1, (selectedAgentIndex ?? 0) + 1);
                if (newIndex >= offset + 10) return newIndex - 9;
                return offset;
              });
            }
          } else if (key.return && selectedAgentIndex !== null) {
            openAgentInbox(selectedAgentIndex);
          }
        } else if (focusedSection === 'agents') {
          // Navigate within agent cards (grid layout)
          if (key.leftArrow) {
            setSelectedAgentIndex((i) => Math.max(0, (i ?? 0) - 1));
          } else if (key.rightArrow) {
            setSelectedAgentIndex((i) => Math.min(maxCardIndex, (i ?? 0) + 1));
          } else if (key.upArrow) {
            setSelectedAgentIndex((i) => Math.max(0, (i ?? 0) - cardsPerRow));
          } else if (key.downArrow) {
            const currentIndex = selectedAgentIndex ?? 0;
            const newIndex = currentIndex + cardsPerRow;
            if (newIndex > maxCardIndex) {
              // Past last row - transition to activity
              setFocusedSection('activity');
              setInteracting(false);
              setSelectedAgentIndex(null);
            } else {
              setSelectedAgentIndex(newIndex);
            }
          } else if (key.return) {
            if (selectedAgentIndex === MAX_VISIBLE_CARDS && hasOverflow) {
              // Open full agent list
              setShowAgentList(true);
              setAgentListIndex(0);
              setAgentListScrollOffset(0);
            } else if (selectedAgentIndex !== null) {
              openAgentInbox(selectedAgentIndex);
            }
          }
        } else if (focusedSection === 'activity') {
          // Navigate within activity feed
          if (key.upArrow) {
            if (selectedActivityIndex === -1) {
              // Already at header - exit to hierarchy
              setFocusedSection('hierarchy');
              setInteracting(false);
              setSelectedActivityIndex(0); // Reset for next time
            } else if (selectedActivityIndex === 0) {
              // At top email - move to header state
              setSelectedActivityIndex(-1);
            } else {
              setSelectedActivityIndex((i) => i - 1);
            }
          } else if (key.downArrow) {
            // If at header, move to first email
            if (selectedActivityIndex === -1) {
              setSelectedActivityIndex(0);
            } else {
              setSelectedActivityIndex((i) => Math.min(activityFeed.length - 1, i + 1));
            }
          } else if (key.return && selectedActivityIndex >= 0 && activityFeed[selectedActivityIndex]) {
            const emailToView = activityFeed[selectedActivityIndex];
            getEmail(emailToView.id, 'ceo').then((result) => {
              if (result) {
                setSelectedEmail(result.email);
                setEmailThread(result.thread);
                setPreviousView('dashboard');
                setView('email-detail');
              }
            });
          }
        }
        return;
      }

      // Hover mode: navigate between sections
      if (focusedSection === 'activity') {
        // From activity feed (hover mode - shouldn't normally happen since we auto-enter)
        if (key.upArrow) {
          setFocusedSection('hierarchy');
        } else if (key.return) {
          // Enter to start interacting with activity feed
          setInteracting(true);
        }
      } else if (focusedSection === 'hierarchy') {
        // From hierarchy section
        if (key.rightArrow) {
          setFocusedSection('agents');
        } else if (key.downArrow) {
          // Enter activity feed directly
          setFocusedSection('activity');
          setInteracting(true);
        } else if (key.return) {
          // Enter to start interacting with hierarchy
          setInteracting(true);
          if (selectedAgentIndex === null) {
            setSelectedAgentIndex(0);
          }
        }
      } else if (focusedSection === 'agents') {
        // From agents section
        if (key.leftArrow) {
          setFocusedSection('hierarchy');
        } else if (key.downArrow) {
          // Enter activity feed directly
          setFocusedSection('activity');
          setInteracting(true);
        } else if (key.return) {
          // Enter to start interacting with agent cards
          setInteracting(true);
          if (selectedAgentIndex === null) {
            setSelectedAgentIndex(0);
          }
        }
      }
    }

    // Agent detail controls
    else if (view === 'agent-detail') {
      if (input.toLowerCase() === 'b' || key.escape) {
        setView('dashboard');
        setSelectedAgentIndex(null);
      } else if (input === 'r' || input === 'R') {
        refreshAgentInbox();
      } else if (key.upArrow) {
        setSelectedEmailIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedEmailIndex((i) => Math.min(agentInbox.length - 1, i + 1));
      } else if (key.return && agentInbox[selectedEmailIndex]) {
        const emailToView = agentInbox[selectedEmailIndex];
        getEmail(emailToView.id, selectedAgentName || 'ceo').then((result) => {
          if (result) {
            setSelectedEmail(result.email);
            setEmailThread(result.thread);
            setPreviousView('agent-detail');
            setView('email-detail');
          }
        });
      } else if (input.toLowerCase() === 'c') {
        setView('compose');
      }
    }

    // Email detail controls
    else if (view === 'email-detail') {
      if (input.toLowerCase() === 'b' || key.escape) {
        setView(previousView);
        setSelectedEmail(null);
        setEmailThread([]);
        if (previousView === 'dashboard') {
          setSelectedAgentIndex(null);
        }
      } else if (input.toLowerCase() === 'r') {
        handleReply();
      }
    }
  });

  // Show disconnected screen when API is unavailable
  if (!apiConnected && !loading) {
    return (
      <Box flexDirection="column" width="100%" height="100%">
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

        <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
          <Text color="red" bold>● API DISCONNECTED</Text>
          <Box marginTop={1}>
            <Text>Unable to connect to mail server at localhost:60061</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Make sure the AGORA mail server is running</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>[</Text>
            <Text bold>R</Text>
            <Text dimColor>] Retry Connection  </Text>
            <Text dimColor>[</Text>
            <Text bold color="red">Q</Text>
            <Text dimColor>] Quit</Text>
          </Box>
        </Box>

        <StatusBar
          view="dashboard"
          apiConnected={false}
          lastRefresh={lastRefresh}
          loading={loading}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
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

      <Box flexDirection="column" flexGrow={1} padding={1}>
        {/* Agent List View (overlay) */}
        {showAgentList && (
          <AgentListView
            agents={agentStats}
            depths={depths}
            selectedIndex={agentListIndex}
            scrollOffset={agentListScrollOffset}
          />
        )}

        {/* Dashboard */}
        {view === 'dashboard' && !showAgentList && (
          <Dashboard
            agentStats={agentStats}
            activityFeed={activityFeed}
            selectedAgentIndex={selectedAgentIndex}
            selectedActivityIndex={selectedActivityIndex}
            onSelectAgent={setSelectedAgentIndex}
            focusedSection={focusedSection}
            interacting={interacting}
            hierarchyScrollOffset={hierarchyScrollOffset}
          />
        )}

        {/* Agent Detail */}
        {view === 'agent-detail' && selectedAgentIndex !== null && agents[selectedAgentIndex] && (
          <Box flexDirection="column" flexGrow={1}>
            <Box marginBottom={1}>
              <Text bold color="cyan">
                AGENT: {agents[selectedAgentIndex].name.toUpperCase()}
              </Text>
              {agents[selectedAgentIndex].supervisor && (
                <Text dimColor> - reports to {agents[selectedAgentIndex].supervisor}</Text>
              )}
            </Box>

            <Box flexDirection="column" marginBottom={1}>
              <Text>
                Received: {agentStats[selectedAgentIndex]?.receivedCount || 0} emails
                ({agentStats[selectedAgentIndex]?.unreadCount || 0} unread)
                | Sent: {agentStats[selectedAgentIndex]?.sentCount || 0}
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

        {/* Email Detail */}
        {view === 'email-detail' && selectedEmail && (
          <EmailDetail
            email={selectedEmail}
            thread={emailThread}
          />
        )}

        {/* Compose */}
        {view === 'compose' && (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <ComposeModal
              onSend={handleSendEmail}
              onCancel={handleCancelCompose}
              replyTo={replyTo || undefined}
              agents={agents}
            />
          </Box>
        )}
      </Box>

      <StatusBar
        view={view}
        apiConnected={apiConnected}
        lastRefresh={lastRefresh}
        loading={loading}
      />
    </Box>
  );
}
