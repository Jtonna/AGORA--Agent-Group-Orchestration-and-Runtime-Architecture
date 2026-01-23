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

function formatRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      const mins = diffMins % 60;
      return mins > 0 ? `${diffHours}h ${mins}m ago` : `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '--';
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
      {displayedEmails.length === 0 ? (
        <Text dimColor>(No recent activity)</Text>
      ) : (
        displayedEmails.map((email, index) => {
          const isSelected = selectedIndex === index;
          const subjectColor = getPrefixColor(email.subject);
          const isUnread = !email.read;

          // Format: "from    → to      " = 8 + 3 + 8 = 19 chars
          const peopleStr = `${email.from.padEnd(8)} → ${(email.to[0] || '').padEnd(8)}`;

          return (
            <Box key={email.id} gap={2}>
              {/* Col 1: Selection indicator */}
              <Box width={3}>
                {isSelected && <Text color="cyan">{'>'}</Text>}
                {!isSelected && <Text>{' '}</Text>}
              </Box>

              {/* Col 2: Read status indicator */}
              <Box width={2}>
                {isUnread && <Text color="yellow">●</Text>}
                {!isUnread && <Text dimColor>○</Text>}
              </Box>

              {/* Col 2: People (from → to) - fixed width */}
              <Box width={19}>
                <Text bold={isUnread}>{peopleStr}</Text>
              </Box>

              {/* Col 3: Subject - flexible */}
              <Box flexGrow={1}>
                <Text color={subjectColor} bold={isUnread}>{truncate(email.subject, 45)}</Text>
              </Box>

              {/* Col 4: Timestamp - right */}
              <Box>
                <Text dimColor={!isUnread}>{formatRelativeTime(email.timestamp)}</Text>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}
