import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';
import { getDepthColor } from '../utils/hierarchyColors.js';

interface AgentListViewProps {
  agents: AgentStats[];
  depths: Map<string, number>;
  selectedIndex: number;
  scrollOffset: number;
  maxVisible?: number;
}

export function AgentListView({
  agents,
  depths,
  selectedIndex,
  scrollOffset,
  maxVisible = 15,
}: AgentListViewProps) {
  const visibleAgents = agents.slice(scrollOffset, scrollOffset + maxVisible);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = agents.length > scrollOffset + maxVisible;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">ALL AGENTS</Text>
        <Text dimColor>  ({agents.length} total)  </Text>
        <Text dimColor>[↑/↓] Navigate  [Enter] Select  [Esc] Back</Text>
      </Box>

      {/* Legend */}
      <Box marginBottom={1}>
        <Text dimColor>S=Sent  R=Received  U=Unread</Text>
      </Box>

      {hasMoreAbove && (
        <Text dimColor>  ↑ {scrollOffset} more above</Text>
      )}

      {visibleAgents.map((agent, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;
        const depth = depths.get(agent.name.toLowerCase()) || 0;
        const depthColor = getDepthColor(depth);

        return (
          <Box key={agent.name}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '> ' : '  '}
            </Text>
            <Text dimColor>[</Text>
            <Text color={isSelected ? 'cyan' : depthColor}>{actualIndex + 1}</Text>
            <Text dimColor>] </Text>
            <Text bold color={isSelected ? 'cyan' : depthColor}>
              {agent.name.toUpperCase().padEnd(12)}
            </Text>
            <Text dimColor> S:</Text>
            <Text>{String(agent.sentCount).padStart(2)}</Text>
            <Text dimColor> R:</Text>
            <Text>{String(agent.receivedCount).padStart(2)}</Text>
            <Text dimColor> U:</Text>
            <Text color={agent.unreadCount > 0 ? 'yellow' : undefined}>
              {String(agent.unreadCount).padStart(2)}
            </Text>
          </Box>
        );
      })}

      {hasMoreBelow && (
        <Text dimColor>  ↓ {agents.length - scrollOffset - maxVisible} more below</Text>
      )}
    </Box>
  );
}
