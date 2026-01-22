import React from 'react';
import { Box, Text } from 'ink';
import { AgentCard } from './AgentCard.js';
import { ActivityFeed } from './ActivityFeed.js';
import type { AgentStats, Email } from '../types/email.js';

interface DashboardProps {
  agentStats: AgentStats[];
  activityFeed: Email[];
  selectedAgentIndex: number | null;
  onSelectAgent: (index: number) => void;
}

export function Dashboard({
  agentStats,
  activityFeed,
  selectedAgentIndex,
  onSelectAgent,
}: DashboardProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Agents Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>AGENTS</Text>
        <Box marginTop={1} gap={2}>
          {agentStats.map((agent, index) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              index={index}
              selected={selectedAgentIndex === index}
            />
          ))}
        </Box>
      </Box>

      {/* Activity Feed Section */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        paddingTop={1}
        flexGrow={1}
      >
        <ActivityFeed emails={activityFeed} maxItems={15} />
      </Box>
    </Box>
  );
}
