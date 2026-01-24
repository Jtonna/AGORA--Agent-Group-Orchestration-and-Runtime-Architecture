import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { AgentCard, MoreCard } from './AgentCard.js';
import { HierarchyTree } from './HierarchyTree.js';
import { ActivityFeed } from './ActivityFeed.js';
import type { AgentStats, Email } from '../types/email.js';
import { calculateAllDepths, HOVER_BORDER_COLOR, INTERACT_BORDER_COLOR } from '../utils/hierarchyColors.js';

type FocusedSection = 'activity' | 'hierarchy' | 'agents';

interface DashboardProps {
  agentStats: AgentStats[];
  activityFeed: Email[];
  selectedAgentIndex: number | null;
  selectedActivityIndex: number;
  onSelectAgent: (index: number) => void;
  focusedSection: FocusedSection;
  interacting: boolean;
  hierarchyScrollOffset?: number;
}

// Max cards to show before "+ X more" (3 rows × ~4 cards)
const MAX_VISIBLE_CARDS = 11;

export function Dashboard({
  agentStats,
  activityFeed,
  selectedAgentIndex,
  selectedActivityIndex,
  onSelectAgent,
  focusedSection,
  interacting,
  hierarchyScrollOffset = 0,
}: DashboardProps) {
  // Calculate depths for all agents
  const depths = useMemo(() => calculateAllDepths(agentStats), [agentStats]);

  // Determine visible cards and overflow
  const hasOverflow = agentStats.length > MAX_VISIBLE_CARDS;
  const visibleAgents = hasOverflow
    ? agentStats.slice(0, MAX_VISIBLE_CARDS)
    : agentStats;
  const overflowCount = agentStats.length - MAX_VISIBLE_CARDS;

  // Check if "+ more" card is selected
  const isMoreCardSelected = selectedAgentIndex === MAX_VISIBLE_CARDS && hasOverflow;

  // Focus states for each section
  const hierarchyFocused = focusedSection === 'hierarchy';
  const hierarchyInteracting = hierarchyFocused && interacting;
  const agentsFocused = focusedSection === 'agents';
  const agentsInteracting = agentsFocused && interacting;

  // Header color for agents section
  const agentsHeaderColor = agentsInteracting
    ? INTERACT_BORDER_COLOR
    : agentsFocused
    ? HOVER_BORDER_COLOR
    : undefined;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Split View: Hierarchy + Agent Cards */}
      <Box marginBottom={1}>
        {/* Left: Hierarchy Tree */}
        <Box width={26} marginRight={1}>
          <HierarchyTree
            agents={agentStats}
            selectedIndex={selectedAgentIndex}
            maxLines={10}
            scrollOffset={hierarchyScrollOffset}
            focused={hierarchyFocused}
            interacting={hierarchyInteracting}
          />
        </Box>

        {/* Right: Agent Cards */}
        <Box flexDirection="column" flexGrow={1}>
          {/* Legend */}
          <Box marginBottom={1}>
            <Text bold dimColor={!agentsFocused} color={agentsHeaderColor}>AGENTS  </Text>
            <Text dimColor>S=Sent  R=Received  U=Unread</Text>
          </Box>

          {/* Agent Cards Grid */}
          <Box flexWrap="wrap" gap={1}>
            {visibleAgents.map((agent, index) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                index={index}
                depth={depths.get(agent.name.toLowerCase()) || 0}
                selected={agentsInteracting && selectedAgentIndex === index}
              />
            ))}
            {hasOverflow && (
              <MoreCard
                count={overflowCount}
                selected={agentsInteracting && isMoreCardSelected}
              />
            )}
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
        <ActivityFeed
          emails={activityFeed}
          maxItems={15}
          selectedIndex={selectedActivityIndex}
          focused={focusedSection === 'activity'}
        />
      </Box>
    </Box>
  );
}

// Re-export for App to use
export { MAX_VISIBLE_CARDS };
export type { FocusedSection };
