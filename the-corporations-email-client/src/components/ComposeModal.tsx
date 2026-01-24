import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { SUBJECT_PREFIXES, type NewEmail, type Agent } from '../types/email.js';

interface ComposeModalProps {
  onSend: (email: NewEmail) => Promise<boolean>;
  onCancel: () => void;
  replyTo?: { from: string; subject: string; id: string };
  agents: Agent[];
}

type ComposeField = 'to' | 'prefix' | 'subject' | 'body' | 'send';
type ComposeState = 'editing' | 'sending' | 'sent' | 'error';

export function ComposeModal({ onSend, onCancel, replyTo, agents }: ComposeModalProps) {
  const [activeField, setActiveField] = useState<ComposeField>('to');
  const [toIndex, setToIndex] = useState(0);
  const [prefixIndex, setPrefixIndex] = useState(0);
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [state, setState] = useState<ComposeState>('editing');
  const [countdown, setCountdown] = useState(5);

  // Filter out CEO since emails are sent FROM CEO
  const recipients = agents.filter((a) => a.name !== 'ceo').map((a) => a.name);

  // Auto-redirect countdown after successful send
  useEffect(() => {
    if (state === 'sent') {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            onCancel(); // Return to dashboard
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state, onCancel]);

  useInput((input, key) => {
    // Don't handle input during sending or after sent
    if (state === 'sending') return;

    if (state === 'sent') {
      // Any key press returns immediately
      onCancel();
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (activeField === 'to') {
      if (key.leftArrow) {
        setToIndex((i) => (i > 0 ? i - 1 : recipients.length - 1));
      } else if (key.rightArrow) {
        setToIndex((i) => (i < recipients.length - 1 ? i + 1 : 0));
      } else if (key.downArrow || key.tab) {
        setActiveField(replyTo ? 'subject' : 'prefix');
      }
    } else if (activeField === 'prefix') {
      if (key.leftArrow) {
        setPrefixIndex((i) => (i > 0 ? i - 1 : SUBJECT_PREFIXES.length - 1));
      } else if (key.rightArrow) {
        setPrefixIndex((i) => (i < SUBJECT_PREFIXES.length - 1 ? i + 1 : 0));
      } else if (key.downArrow || key.tab) {
        setActiveField('subject');
      } else if (key.upArrow) {
        setActiveField('to');
      }
    } else if (activeField === 'subject') {
      if (key.downArrow || key.tab) {
        setActiveField('body');
      } else if (key.upArrow) {
        setActiveField(replyTo ? 'to' : 'prefix');
      }
    } else if (activeField === 'body') {
      if ((key.downArrow || key.tab) && body !== '') {
        setActiveField('send');
      } else if (key.tab) {
        setActiveField('send');
      } else if (key.upArrow && body === '') {
        setActiveField('subject');
      }
    } else if (activeField === 'send') {
      if (key.upArrow) {
        setActiveField('body');
      } else if (key.return) {
        handleSend();
      }
    }
  });

  const handleSend = async () => {
    setState('sending');

    const fullSubject = replyTo
      ? subject
      : `${SUBJECT_PREFIXES[prefixIndex]} ${subject}`;

    const email: NewEmail = {
      from: 'ceo',
      to: [recipients[toIndex]],
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
      // Reset to editing after showing error
      setTimeout(() => setState('editing'), 2000);
    }
  };

  // Sent confirmation screen
  if (state === 'sent') {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="green"
        padding={2}
        width="60%"
        alignItems="center"
      >
        <Text bold color="green">EMAIL SENT SUCCESSFULLY</Text>
        <Box marginTop={1}>
          <Text>To: </Text>
          <Text bold>{recipients[toIndex].toUpperCase()}</Text>
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
    );
  }

  // Sending state
  if (state === 'sending') {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="yellow"
        padding={2}
        width="60%"
        alignItems="center"
      >
        <Text bold color="yellow">SENDING EMAIL...</Text>
      </Box>
    );
  }

  // Error state shows briefly then returns to editing
  if (state === 'error') {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="red"
        padding={2}
        width="60%"
        alignItems="center"
      >
        <Text bold color="red">FAILED TO SEND EMAIL</Text>
        <Box marginTop={1}>
          <Text dimColor>Please try again...</Text>
        </Box>
      </Box>
    );
  }

  // Normal editing view
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      width="80%"
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          {replyTo ? 'REPLY TO EMAIL' : 'COMPOSE NEW EMAIL'}
        </Text>
      </Box>

      {/* From field */}
      <Box marginBottom={1}>
        <Text dimColor>From: </Text>
        <Text bold color="green">CEO</Text>
      </Box>

      {/* To field */}
      <Box marginBottom={1}>
        <Text dimColor>To:   </Text>
        {recipients.map((r, i) => (
          <Box key={r} marginRight={1}>
            <Text
              backgroundColor={i === toIndex ? 'cyan' : undefined}
              color={i === toIndex ? 'black' : activeField === 'to' ? 'white' : 'gray'}
              bold={i === toIndex}
            >
              {' '}{r.toUpperCase()}{' '}
            </Text>
          </Box>
        ))}
        {activeField === 'to' && (
          <Text dimColor> (←/→ to select)</Text>
        )}
      </Box>

      {/* Prefix selector (only for new emails) */}
      {!replyTo && (
        <Box marginBottom={1} flexWrap="wrap">
          <Text dimColor>Type: </Text>
          <Text
            backgroundColor={activeField === 'prefix' ? 'cyan' : undefined}
            color={activeField === 'prefix' ? 'black' : 'white'}
          >
            {SUBJECT_PREFIXES[prefixIndex]}
          </Text>
          {activeField === 'prefix' && (
            <Text dimColor> (←/→ to change)</Text>
          )}
        </Box>
      )}

      {/* Subject field */}
      <Box marginBottom={1}>
        <Text dimColor>Subj: </Text>
        {activeField === 'subject' ? (
          <Box borderStyle="single" borderColor="cyan" paddingX={1} flexGrow={1}>
            <TextInput
              value={subject}
              onChange={setSubject}
              placeholder="Enter subject..."
            />
          </Box>
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
        <Text color="yellow">Tab/↓</Text>
        <Text dimColor>] Navigate  </Text>
        <Text dimColor>[</Text>
        <Text color="green">Enter</Text>
        <Text dimColor>] Send (on button)  </Text>
        <Text dimColor>[</Text>
        <Text color="red">Esc</Text>
        <Text dimColor>] Cancel</Text>
      </Box>
    </Box>
  );
}
