import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';

interface AgentCardProps {
  agent: AgentStats;
  selected?: boolean;
  index: number;
}

export function AgentCard({ agent, selected, index }: AgentCardProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={selected ? 'cyan' : 'gray'}
      paddingX={1}
      width={18}
    >
      {/* [n] NAME */}
      <Box>
        <Text dimColor>[</Text>
        <Text bold color={selected ? 'cyan' : undefined}>{index + 1}</Text>
        <Text dimColor>] </Text>
        <Text bold color={selected ? 'cyan' : 'white'}>
          {agent.name.toUpperCase()}
        </Text>
      </Box>

      {/* S:x  R:x  U:x */}
      <Box>
        <Text dimColor>S:</Text>
        <Text>{agent.sentCount}</Text>
        <Text>  </Text>
        <Text dimColor>R:</Text>
        <Text>{agent.receivedCount}</Text>
        <Text>  </Text>
        <Text dimColor>U:</Text>
        <Text color={agent.unreadCount > 0 ? 'yellow' : undefined}>
          {agent.unreadCount}
        </Text>
      </Box>

      {/* → supervisor or (top-level) */}
      <Box>
        <Text dimColor>
          {agent.supervisor ? `→ ${agent.supervisor}` : '(top-level)'}
        </Text>
      </Box>
    </Box>
  );
}
