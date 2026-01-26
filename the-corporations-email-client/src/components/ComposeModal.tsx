import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { NewEmail, Agent, AgentStats } from '../types/email.js';
import { HierarchyTree } from './HierarchyTree.js';
import { AutocompleteInput } from './AutocompleteInput.js';

interface ComposeModalProps {
  onSend: (email: NewEmail) => Promise<boolean>;
  onCancel: () => void;
  replyTo?: { from: string; subject: string; id: string };
  agents: Agent[];
  agentStats: AgentStats[];
  subjectPrefixes: string[];
}

type ComposeField = 'hierarchy' | 'from' | 'to' | 'prefix' | 'subject' | 'body' | 'send';
type ComposeState = 'editing' | 'sending' | 'sent' | 'error';

export function ComposeModal({ onSend, onCancel, replyTo, agents, agentStats, subjectPrefixes }: ComposeModalProps) {
  // Find IMPORTANT index for default prefix
  const importantIndex = useMemo(() => {
    const idx = subjectPrefixes.findIndex(p => p.toUpperCase().includes('IMPORTANT'));
    return idx >= 0 ? idx : 0;
  }, [subjectPrefixes]);

  const [activeField, setActiveField] = useState<ComposeField>('to');
  const [hierarchyIndex, setHierarchyIndex] = useState(0);
  const [fromValue, setFromValue] = useState('ceo');
  const [toValue, setToValue] = useState('');
  const [prefixIndex, setPrefixIndex] = useState(importantIndex);
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [state, setState] = useState<ComposeState>('editing');
  const [countdown, setCountdown] = useState(5);

  // Build suggestions lists
  const allAgentNames = useMemo(() =>
    agents.map(a => a.name.toLowerCase()),
    [agents]
  );

  const toSuggestions = useMemo(() =>
    ['everyone', ...allAgentNames.filter(n => n !== 'ceo')],
    [allAgentNames]
  );

  const fromSuggestions = useMemo(() =>
    allAgentNames,
    [allAgentNames]
  );

  // Auto-redirect countdown after successful send
  useEffect(() => {
    if (state === 'sent') {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            onCancel();
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state, onCancel]);

  useInput((input, key) => {
    if (state === 'sending') return;

    if (state === 'sent') {
      onCancel();
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Hierarchy navigation
    if (activeField === 'hierarchy') {
      if (key.upArrow) {
        setHierarchyIndex(i => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setHierarchyIndex(i => Math.min(agentStats.length - 1, i + 1));
      } else if (key.return) {
        // Select agent as recipient
        if (agentStats[hierarchyIndex]) {
          setToValue(agentStats[hierarchyIndex].name);
          setActiveField('to');
        }
      } else if (key.rightArrow || key.tab) {
        setActiveField('from');
      }
      return;
    }

    // Prefix selector
    if (activeField === 'prefix') {
      if (key.leftArrow) {
        setPrefixIndex(i => (i > 0 ? i - 1 : subjectPrefixes.length - 1));
      } else if (key.rightArrow) {
        setPrefixIndex(i => (i < subjectPrefixes.length - 1 ? i + 1 : 0));
      } else if (key.downArrow || key.tab) {
        setActiveField('subject');
      } else if (key.upArrow) {
        setActiveField('to');
      }
      return;
    }

    // Subject field
    if (activeField === 'subject') {
      if (key.downArrow || key.tab) {
        setActiveField('body');
      } else if (key.upArrow) {
        setActiveField(replyTo ? 'to' : 'prefix');
      }
      return;
    }

    // Body field
    if (activeField === 'body') {
      if (key.downArrow || key.tab) {
        setActiveField('send');
      } else if (key.upArrow && body === '') {
        setActiveField('subject');
      }
      return;
    }

    // Send button
    if (activeField === 'send') {
      if (key.upArrow) {
        setActiveField('body');
      } else if (key.return) {
        handleSend();
      }
      return;
    }
  });

  const handleSend = async () => {
    setState('sending');

    // Use "READ IMMEDIATELY" if subject is empty
    const actualSubject = subject.trim() || 'READ IMMEDIATELY';
    const fullSubject = replyTo
      ? actualSubject
      : `${subjectPrefixes[prefixIndex]} ${actualSubject}`;

    // Determine recipient - empty or "everyone" means everyone
    const recipient = (!toValue || toValue.toLowerCase() === 'everyone')
      ? 'everyone'
      : toValue.toLowerCase();

    const email: NewEmail = {
      from: fromValue.toLowerCase() || 'ceo',
      to: [recipient],
      subject: fullSubject,
      content: body,
      ...(replyTo && { isResponseTo: replyTo.id }),
    };

    const success = await onSend(email);

    if (success) {
      setState('sent');
      setCountdown(5);
    } else {
      setState('error');
      setTimeout(() => setState('editing'), 2000);
    }
  };

  // Sent confirmation screen
  if (state === 'sent') {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={26} marginRight={1}>
          <HierarchyTree agents={agentStats} selectedIndex={null} />
        </Box>
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="green"
          padding={2}
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
        >
          <Text bold color="green">EMAIL SENT SUCCESSFULLY</Text>
          <Box marginTop={1}>
            <Text>To: </Text>
            <Text bold>{toValue.toUpperCase() || 'EVERYONE'}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Returning to dashboard in </Text>
            <Text bold color="yellow">{countdown}</Text>
            <Text dimColor> seconds...</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>(Press any key to return now)</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Sending state
  if (state === 'sending') {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={26} marginRight={1}>
          <HierarchyTree agents={agentStats} selectedIndex={null} />
        </Box>
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="yellow"
          padding={2}
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
        >
          <Text bold color="yellow">SENDING EMAIL...</Text>
        </Box>
      </Box>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={26} marginRight={1}>
          <HierarchyTree agents={agentStats} selectedIndex={null} />
        </Box>
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="red"
          padding={2}
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
        >
          <Text bold color="red">FAILED TO SEND EMAIL</Text>
          <Box marginTop={1}>
            <Text dimColor>Please try again...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Normal editing view
  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left: Hierarchy Tree (interactive) */}
      <Box width={26} marginRight={1} flexDirection="column">
        <HierarchyTree
          agents={agentStats}
          selectedIndex={activeField === 'hierarchy' ? hierarchyIndex : null}
          focused={activeField === 'hierarchy'}
          interacting={activeField === 'hierarchy'}
        />
        {activeField === 'hierarchy' && (
          <Box marginTop={1}>
            <Text dimColor>↑↓ Navigate, Enter to select</Text>
          </Box>
        )}
      </Box>

      {/* Right: Compose Form */}
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        padding={1}
        flexGrow={1}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">
            {replyTo ? 'REPLY TO EMAIL' : 'COMPOSE NEW EMAIL'}
          </Text>
        </Box>

        {/* From field */}
        <Box marginBottom={1}>
          <Text dimColor>From: </Text>
          <AutocompleteInput
            value={fromValue}
            onChange={setFromValue}
            suggestions={fromSuggestions}
            placeholder="ceo"
            isActive={activeField === 'from'}
            onNavigateNext={() => setActiveField('to')}
            onNavigatePrev={() => setActiveField('hierarchy')}
          />
        </Box>

        {/* To field */}
        <Box marginBottom={1}>
          <Text dimColor>To:   </Text>
          <AutocompleteInput
            value={toValue}
            onChange={setToValue}
            suggestions={toSuggestions}
            placeholder="everyone"
            defaultHint="(default: everyone - not recommended)"
            isActive={activeField === 'to'}
            onNavigateNext={() => setActiveField(replyTo ? 'subject' : 'prefix')}
            onNavigatePrev={() => setActiveField('from')}
          />
        </Box>

        {/* Prefix selector (only for new emails) */}
        {!replyTo && (
          <Box marginBottom={1} flexWrap="wrap">
            <Text dimColor>Type: </Text>
            <Text
              backgroundColor={activeField === 'prefix' ? 'cyan' : undefined}
              color={activeField === 'prefix' ? 'black' : 'white'}
            >
              {subjectPrefixes[prefixIndex]}
            </Text>
            {activeField === 'prefix' && (
              <Text dimColor> (←/→ to change)</Text>
            )}
          </Box>
        )}

        {/* Subject field - no border box */}
        <Box marginBottom={1}>
          <Text dimColor>Subj: </Text>
          {activeField === 'subject' ? (
            <TextInput
              value={subject}
              onChange={setSubject}
              placeholder="(optional)"
            />
          ) : (
            <Text color={subject ? 'white' : 'gray'}>
              {subject || '(empty)'}
            </Text>
          )}
        </Box>

        {/* Body field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Body:</Text>
          <Box
            borderStyle="single"
            borderColor={activeField === 'body' ? 'cyan' : 'gray'}
            padding={1}
            minHeight={5}
          >
            {activeField === 'body' ? (
              <TextInput
                value={body}
                onChange={setBody}
                placeholder="Type your message here..."
              />
            ) : (
              <Text color={body ? 'white' : 'gray'}>
                {body || '(empty)'}
              </Text>
            )}
          </Box>
        </Box>

        {/* Send Button */}
        <Box justifyContent="center" marginTop={1}>
          <Box
            borderStyle={activeField === 'send' ? 'double' : 'single'}
            borderColor={activeField === 'send' ? 'green' : 'gray'}
            paddingX={3}
            paddingY={0}
          >
            <Text
              bold
              color={activeField === 'send' ? 'green' : 'white'}
            >
              {activeField === 'send' ? '[ SEND EMAIL ]' : '  SEND EMAIL  '}
            </Text>
          </Box>
        </Box>

        {/* Controls */}
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>[</Text>
          <Text color="yellow">Tab</Text>
          <Text dimColor>] Next  </Text>
          <Text dimColor>[</Text>
          <Text color="cyan">←</Text>
          <Text dimColor>] Hierarchy  </Text>
          <Text dimColor>[</Text>
          <Text color="green">Enter</Text>
          <Text dimColor>] Send  </Text>
          <Text dimColor>[</Text>
          <Text color="red">Esc</Text>
          <Text dimColor>] Cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
