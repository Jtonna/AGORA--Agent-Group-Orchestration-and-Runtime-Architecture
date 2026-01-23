import React from 'react';
import { Box, Text } from 'ink';
import type { Email } from '../types/email.js';

interface EmailDetailProps {
  email: Email;
  thread?: Email[];
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

export function EmailDetail({ email, thread, onBack, onReply }: EmailDetailProps) {
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
        minHeight={5}
      >
        <Text>{email.content || '(No content)'}</Text>
      </Box>

      {/* Thread Chain */}
      {thread && thread.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor>
            CONVERSATION THREAD ({thread.length} {thread.length === 1 ? 'other message' : 'other messages'})
          </Text>
          {thread.map((e) => (
            <Box
              key={e.id}
              flexDirection="column"
              marginTop={1}
              borderStyle="single"
              borderColor="gray"
              padding={1}
            >
              <Box>
                <Text bold>{e.from.toUpperCase()}</Text>
                <Text dimColor> → </Text>
                <Text>{e.to.map((t) => t.toUpperCase()).join(', ')}</Text>
                <Text dimColor>  {formatDate(e.timestamp)}</Text>
              </Box>
              <Box marginTop={1}>
                <Text color={getPrefixColor(e.subject)}>{e.subject}</Text>
              </Box>
              {e.content && (
                <Box marginTop={1}>
                  <Text dimColor>{e.content.slice(0, 200)}{e.content.length > 200 ? '...' : ''}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

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
