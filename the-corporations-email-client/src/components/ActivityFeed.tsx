import React from 'react';
import { Box, Text } from 'ink';
import type { Email } from '../types/email.js';

interface ActivityFeedProps {
  emails: Email[];
  maxItems?: number;
  onSelectEmail?: (email: Email) => void;
  selectedIndex?: number;
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

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function ActivityFeed({
  emails,
  maxItems = 15,
  onSelectEmail,
  selectedIndex,
}: ActivityFeedProps) {
  const displayedEmails = emails.slice(0, maxItems);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold>RECENT MAILBOX ACTIVITY</Text>
        <Box>
          <Text dimColor>[LIVE </Text>
          <Text color="green">●</Text>
          <Text dimColor>]</Text>
        </Box>
      </Box>

      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} />

      {displayedEmails.length === 0 ? (
        <Text dimColor>(No recent activity)</Text>
      ) : (
        displayedEmails.map((email, index) => {
          const isSelected = selectedIndex === index;
          const subjectColor = getPrefixColor(email.subject);

          return (
            <Box key={email.id}>
              {isSelected && <Text color="cyan">{'> '}</Text>}
              {!isSelected && <Text>{'  '}</Text>}
              <Text dimColor>{formatTime(email.timestamp)}  </Text>
              <Text bold>{email.from.padEnd(8)}</Text>
              <Text dimColor> → </Text>
              <Text>{(email.to[0] || '').padEnd(8)}</Text>
              <Text>  </Text>
              <Text color={subjectColor}>{truncate(email.subject, 60)}</Text>
              {!email.read && <Text color="yellow"> *</Text>}
            </Box>
          );
        })
      )}
    </Box>
  );
}
