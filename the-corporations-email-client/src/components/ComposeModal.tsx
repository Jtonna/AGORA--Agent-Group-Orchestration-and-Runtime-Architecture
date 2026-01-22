import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AGENTS, SUBJECT_PREFIXES, type NewEmail } from '../types/email.js';

interface ComposeModalProps {
  onSend: (email: NewEmail) => void;
  onCancel: () => void;
  replyTo?: { from: string; subject: string; id: string };
}

type ComposeField = 'to' | 'prefix' | 'subject' | 'body';

export function ComposeModal({ onSend, onCancel, replyTo }: ComposeModalProps) {
  const [activeField, setActiveField] = useState<ComposeField>('to');
  const [toIndex, setToIndex] = useState(0);
  const [prefixIndex, setPrefixIndex] = useState(0);
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');

  const recipients = AGENTS.map((a) => a.name);

  useInput((input, key) => {
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
        setActiveField('prefix');
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
        setActiveField('prefix');
      }
    } else if (activeField === 'body') {
      if (key.upArrow && body === '') {
        setActiveField('subject');
      }
      if (key.ctrl && input === 's') {
        handleSend();
      }
    }
  });

  const handleSend = () => {
    const fullSubject = replyTo
      ? subject
      : `${SUBJECT_PREFIXES[prefixIndex]} ${subject}`;

    const email: NewEmail = {
      from: 'ceo',
      to: [recipients[toIndex]],
      subject: fullSubject,
      body,
      ...(replyTo && { replyTo: replyTo.id }),
    };

    onSend(email);
  };

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
          <Text dimColor> ←/→ to select</Text>
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
            <Text dimColor> ←/→ to change</Text>
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
            {subject || '(click to edit)'}
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
              {body || '(click to edit)'}
            </Text>
          )}
        </Box>
      </Box>

      {/* Controls */}
      <Box justifyContent="space-between" marginTop={1}>
        <Box>
          <Text dimColor>[</Text>
          <Text color="green">Ctrl+S</Text>
          <Text dimColor>] Send  </Text>
          <Text dimColor>[</Text>
          <Text color="yellow">Tab/↓</Text>
          <Text dimColor>] Next field  </Text>
          <Text dimColor>[</Text>
          <Text color="red">Esc</Text>
          <Text dimColor>] Cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
