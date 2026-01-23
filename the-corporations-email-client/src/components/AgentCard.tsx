import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats, AgentStatus } from '../types/email.js';

interface AgentCardProps {
  agent: AgentStats;
  selected?: boolean;
  index: number;
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'waiting':
      return 'yellow';
    case 'blocked':
      return 'red';
    default:
      return 'gray';
  }
}

function getStatusIcon(status: AgentStatus): string {
  return '●';
}

export function AgentCard({ agent, selected, index }: AgentCardProps) {
  const statusColor = getStatusColor(agent.status);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={selected ? 'cyan' : 'white'}
      paddingX={1}
      width={18}
    >
      <Box justifyContent="space-between">
        <Text bold color={selected ? 'cyan' : 'white'}>
          {agent.name.toUpperCase()}
        </Text>
        <Text dimColor>[{index + 1}]</Text>
      </Box>

      <Box>
        <Text color={statusColor}>{getStatusIcon(agent.status)} </Text>
        <Text>{agent.role}</Text>
      </Box>

      <Box>
        <Text dimColor>Sent: </Text>
        <Text>{agent.sentCount}</Text>
      </Box>

      <Box>
        <Text dimColor>Recv: </Text>
        <Text>{agent.receivedCount}</Text>
      </Box>

      <Box>
        <Text dimColor>Unread: </Text>
        <Text color={agent.unreadCount > 0 ? 'yellow' : undefined}>
          {agent.unreadCount}
        </Text>
      </Box>
    </Box>
  );
}
