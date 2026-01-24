import React from 'react';
import { Box, Text } from 'ink';
import { AgentCard } from './AgentCard.js';
import { HierarchyTree } from './HierarchyTree.js';
import { ActivityFeed } from './ActivityFeed.js';
import type { AgentStats, Email } from '../types/email.js';

interface DashboardProps {
  agentStats: AgentStats[];
  activityFeed: Email[];
  selectedAgentIndex: number | null;
  selectedActivityIndex: number;
  onSelectAgent: (index: number) => void;
}

export function Dashboard({
  agentStats,
  activityFeed,
  selectedAgentIndex,
  selectedActivityIndex,
  onSelectAgent,
}: DashboardProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Split View: Hierarchy + Agent Cards */}
      <Box marginBottom={1}>
        {/* Left: Hierarchy Tree */}
        <Box width={24} marginRight={2}>
          <HierarchyTree agents={agentStats} selectedIndex={selectedAgentIndex} />
        </Box>

        {/* Right: Agent Cards with Legend */}
        <Box flexDirection="column" flexGrow={1}>
          {/* Legend */}
          <Box marginBottom={1}>
            <Text bold dimColor>AGENTS  </Text>
            <Text dimColor>S=Sent  R=Received  U=Unread</Text>
          </Box>

          {/* Agent Cards Grid */}
          <Box flexWrap="wrap" gap={1}>
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
        <ActivityFeed emails={activityFeed} maxItems={15} selectedIndex={selectedActivityIndex} />
      </Box>
    </Box>
  );
}
