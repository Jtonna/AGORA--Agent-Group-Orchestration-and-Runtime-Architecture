import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';
import { getDepthColor } from '../utils/hierarchyColors.js';

interface AgentCardProps {
  agent: AgentStats;
  selected?: boolean;
  index: number;
  depth: number;
}

export function AgentCard({ agent, selected, index, depth }: AgentCardProps) {
  const depthColor = getDepthColor(depth);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={selected ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* [n] NAME */}
      <Box>
        <Text dimColor>[</Text>
        <Text bold color={selected ? 'cyan' : depthColor}>{index + 1}</Text>
        <Text dimColor>] </Text>
        <Text bold color={selected ? 'cyan' : depthColor}>
          {agent.name.toUpperCase()}
        </Text>
      </Box>

      {/* S:x  R:x  U:x */}
      <Box>
        <Text dimColor>S:</Text>
        <Text>{agent.sentCount}</Text>
        <Text> </Text>
        <Text dimColor>R:</Text>
        <Text>{agent.receivedCount}</Text>
        <Text> </Text>
        <Text dimColor>U:</Text>
        <Text color={agent.unreadCount > 0 ? 'yellow' : undefined}>
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
      borderColor={selected ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box>
        <Text bold color={selected ? 'cyan' : 'white'}>
          + {count} more
        </Text>
      </Box>
      <Box>
        <Text dimColor>Enter to view</Text>
      </Box>
    </Box>
  );
}
