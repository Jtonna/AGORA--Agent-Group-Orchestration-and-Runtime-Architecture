import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';
import { getDepthColor, SELECTION_COLOR, HOVER_BORDER_COLOR, INTERACT_BORDER_COLOR } from '../utils/hierarchyColors.js';

interface HierarchyTreeProps {
  agents: AgentStats[];
  selectedIndex: number | null;
  maxLines?: number;
  scrollOffset?: number;
  focused?: boolean;
  interacting?: boolean;
}

interface TreeNode {
  agent: AgentStats;
  index: number;
  depth: number;
  children: TreeNode[];
}

interface FlatLine {
  prefix: string;
  connector: string;
  name: string;
  depth: number;
  index: number;
  isSelected: boolean;
}

function buildTree(agents: AgentStats[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  agents.forEach((agent, index) => {
    nodeMap.set(agent.name.toLowerCase(), {
      agent,
      index,
      depth: 0,
      children: [],
    });
  });

  const roots: TreeNode[] = [];
  agents.forEach((agent) => {
    const node = nodeMap.get(agent.name.toLowerCase())!;
    const supervisorName = agent.supervisor?.toLowerCase();

    if (supervisorName && nodeMap.has(supervisorName)) {
      nodeMap.get(supervisorName)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  function setDepths(node: TreeNode, depth: number) {
    node.depth = depth;
    node.children.forEach((child) => setDepths(child, depth + 1));
  }
  roots.forEach((root) => setDepths(root, 0));

  return roots;
}

function flattenTree(
  roots: TreeNode[],
  selectedIndex: number | null
): FlatLine[] {
  const lines: FlatLine[] = [];

  function traverse(node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean) {
    const connector = isRoot ? '' : (isLast ? '└─' : '├─');

    lines.push({
      prefix,
      connector,
      name: node.agent.name,
      depth: node.depth,
      index: node.index,
      isSelected: node.index === selectedIndex,
    });

    const childPrefix = isRoot ? '' : prefix + (isLast ? '  ' : '│ ');
    node.children.forEach((child, i) => {
      traverse(child, childPrefix, i === node.children.length - 1, false);
    });
  }

  roots.forEach((root, i) => {
    traverse(root, '', i === roots.length - 1, true);
  });

  return lines;
}

export function HierarchyTree({
  agents,
  selectedIndex,
  maxLines = 10,
  scrollOffset = 0,
  focused = false,
  interacting = false,
}: HierarchyTreeProps) {
  const roots = buildTree(agents);
  const allLines = flattenTree(roots, selectedIndex);

  const visibleLines = allLines.slice(scrollOffset, scrollOffset + maxLines);
  const hasMore = allLines.length > scrollOffset + maxLines;
  const hasScrolledPast = scrollOffset > 0;

  // Determine header color based on state
  const headerColor = interacting
    ? INTERACT_BORDER_COLOR
    : focused
    ? HOVER_BORDER_COLOR
    : undefined;

  return (
    <Box flexDirection="column">
      <Text bold dimColor={!focused && !interacting} color={headerColor}>
        HIERARCHY
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {hasScrolledPast && (
          <Text dimColor>  ↑ more</Text>
        )}
        {visibleLines.map((line, i) => {
          const isSelected = line.isSelected && interacting;
          const color = isSelected ? SELECTION_COLOR : getDepthColor(line.depth);

          return (
            <Box key={`${line.name}-${i}`}>
              <Text dimColor>{line.prefix}{line.connector}</Text>
              <Text color={color}>o </Text>
              <Text bold={isSelected} color={color}>
                {line.name}
              </Text>
            </Box>
          );
        })}
        {hasMore && (
          <Text dimColor>  ↓ more</Text>
        )}
      </Box>
    </Box>
  );
}

// Export for finding agent position in tree
export function getAgentTreePosition(agents: AgentStats[], agentIndex: number): number {
  const roots = buildTree(agents);
  const allLines = flattenTree(roots, null);
  const lineIndex = allLines.findIndex((line) => line.index === agentIndex);
  return lineIndex >= 0 ? lineIndex : 0;
}

export { buildTree };
