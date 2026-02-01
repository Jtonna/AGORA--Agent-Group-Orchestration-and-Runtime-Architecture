import React from 'react';
import { Box, Text } from 'ink';
import type { Email } from '../types/email.js';

interface ThreadViewProps {
  emails: Email[];
  selectedIndex: number;
  onSelectEmail: (index: number) => void;
  onBack: () => void;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function ThreadView({
  emails,
  selectedIndex,
  onSelectEmail,
  onBack,
}: ThreadViewProps) {
  if (emails.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No emails in thread</Text>
        <Box marginTop={1}>
          <Text dimColor>[</Text>
          <Text bold color="cyan">B</Text>
          <Text dimColor>] Back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          THREAD: {truncate(emails[0]?.subject || 'Unknown', 60)}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        padding={1}
      >
        {emails.map((email, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box
              key={email.id}
              flexDirection="column"
              marginBottom={index < emails.length - 1 ? 1 : 0}
              borderStyle={isSelected ? 'single' : undefined}
              borderColor="cyan"
              padding={isSelected ? 1 : 0}
            >
              <Box>
                {isSelected && <Text color="cyan">{'> '}</Text>}
                {!isSelected && <Text>{'  '}</Text>}
                <Text bold>{email.from.toUpperCase()}</Text>
                <Text dimColor> → </Text>
                <Text>{email.to.map((t) => t.toUpperCase()).join(', ')}</Text>
                <Text dimColor>  {formatTime(email.timestamp)}</Text>
              </Box>

              {isSelected && email.content && (
                <Box marginTop={1} marginLeft={2}>
                  <Text wrap="wrap">{email.content}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>[</Text>
        <Text bold>↑/↓</Text>
        <Text dimColor>] Navigate  </Text>
        <Text dimColor>[</Text>
        <Text bold color="green">Enter</Text>
        <Text dimColor>] View Full  </Text>
        <Text dimColor>[</Text>
        <Text bold color="cyan">B</Text>
        <Text dimColor>] Back</Text>
      </Box>
    </Box>
  );
}
