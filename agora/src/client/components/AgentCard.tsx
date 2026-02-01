import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';
import { getDepthColor, SELECTION_COLOR, INTERACT_BORDER_COLOR } from '../utils/hierarchyColors.js';

interface AgentCardProps {
  agent: AgentStats;
  selected?: boolean;
  depth: number;
}

// Fixed card width for predictable grid navigation
export const CARD_WIDTH = 18;

export function AgentCard({ agent, selected, depth }: AgentCardProps) {
  const depthColor = getDepthColor(depth);
  const displayColor = selected ? SELECTION_COLOR : depthColor;
  const borderColor = selected ? INTERACT_BORDER_COLOR : 'gray';

  // Truncate name to fit card width (width - borders - padding = 18 - 2 - 2 = 14)
  const maxNameLen = 14;
  const displayName = agent.name.length > maxNameLen
    ? agent.name.slice(0, maxNameLen - 1) + '…'
    : agent.name;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      width={CARD_WIDTH}
    >
      {/* NAME */}
      <Box>
        <Text bold color={displayColor}>
          {displayName.toUpperCase()}
        </Text>
      </Box>

      {/* S:x  R:x  U:x */}
      <Box>
        <Text dimColor>S:{agent.sentCount} R:{agent.receivedCount} U:</Text>
        <Text color={agent.unreadCount > 0 ? 'white' : undefined}>
          {agent.unreadCount}
        </Text>
      </Box>
    </Box>
  );
}

// Special card for "+ X more" overflow
interface MoreCardProps {
  count: number;
  selected?: boolean;
}

export function MoreCard({ count, selected }: MoreCardProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={selected ? INTERACT_BORDER_COLOR : 'gray'}
      paddingX={1}
      width={CARD_WIDTH}
    >
      <Box>
        <Text bold color={selected ? SELECTION_COLOR : 'white'}>
          + {count} more
        </Text>
      </Box>
      <Box>
        <Text dimColor>Enter to view</Text>
      </Box>
    </Box>
  );
}
