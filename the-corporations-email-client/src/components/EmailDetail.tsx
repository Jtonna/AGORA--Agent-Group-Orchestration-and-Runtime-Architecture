import React from 'react';
import { Box, Text } from 'ink';
import type { Email } from '../types/email.js';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onReply: () => void;
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function getPrefixColor(subject: string): string {
  if (subject.startsWith('APPROVED:') || subject.startsWith('COMPLETE:')) {
    return 'green';
  }
  if (subject.startsWith('PROGRESS:') || subject.startsWith('ACKNOWLEDGED:')) {
    return 'yellow';
  }
  if (
    subject.startsWith('BLOCKED:') ||
    subject.startsWith('QUESTION:') ||
    subject.startsWith('REVISION:')
  ) {
    return 'red';
  }
  if (subject.startsWith('GETTING STARTED:') || subject.startsWith('IMPORTANT:')) {
    return 'cyan';
  }
  if (subject.startsWith('COLLABORATION')) {
    return 'magenta';
  }
  return 'white';
}

export function EmailDetail({ email, onBack, onReply }: EmailDetailProps) {
  const subjectColor = getPrefixColor(email.subject);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box
        borderStyle="single"
        borderColor="cyan"
        flexDirection="column"
        padding={1}
        marginBottom={1}
      >
        <Box>
          <Text bold color={subjectColor}>
            {email.subject}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>From: </Text>
          <Text bold>{email.from.toUpperCase()}</Text>
        </Box>

        <Box>
          <Text dimColor>To:   </Text>
          <Text>{email.to.map((t) => t.toUpperCase()).join(', ')}</Text>
        </Box>

        <Box>
          <Text dimColor>Date: </Text>
          <Text>{formatDate(email.timestamp)}</Text>
        </Box>

        {email.threadId && (
          <Box>
            <Text dimColor>Thread: </Text>
            <Text color="gray">{email.threadId}</Text>
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box
        borderStyle="single"
        borderColor="gray"
        flexDirection="column"
        padding={1}
        flexGrow={1}
        minHeight={10}
      >
        <Text>{email.body || '(No content)'}</Text>
      </Box>

      {/* Controls */}
      <Box marginTop={1}>
        <Text dimColor>[</Text>
        <Text bold color="cyan">B</Text>
        <Text dimColor>] Back  </Text>
        <Text dimColor>[</Text>
        <Text bold color="green">R</Text>
        <Text dimColor>] Reply  </Text>
      </Box>
    </Box>
  );
}
