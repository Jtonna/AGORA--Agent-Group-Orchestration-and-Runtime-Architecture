import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStats } from '../types/email.js';

interface HierarchyTreeProps {
  agents: AgentStats[];
  selectedIndex: number | null;
}

interface TreeNode {
  agent: AgentStats;
  index: number;
  children: TreeNode[];
}

function buildTree(agents: AgentStats[]): TreeNode[] {
  // Create a map for quick lookup
  const agentMap = new Map<string, { agent: AgentStats; index: number }>();
  agents.forEach((agent, index) => {
    agentMap.set(agent.name.toLowerCase(), { agent, index });
  });

  // Find root nodes (no supervisor or supervisor not in list)
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Create TreeNode for each agent
  agents.forEach((agent, index) => {
    nodeMap.set(agent.name.toLowerCase(), {
      agent,
      index,
      children: [],
    });
  });

  // Build parent-child relationships
  agents.forEach((agent) => {
    const node = nodeMap.get(agent.name.toLowerCase())!;
    const supervisorName = agent.supervisor?.toLowerCase();

    if (supervisorName && nodeMap.has(supervisorName)) {
      // Has a supervisor in the list - add as child
      nodeMap.get(supervisorName)!.children.push(node);
    } else {
      // No supervisor or supervisor not in list - it's a root
      roots.push(node);
    }
  });

  return roots;
}

interface TreeLineProps {
  node: TreeNode;
  prefix: string;
  isLast: boolean;
  selectedIndex: number | null;
}

function TreeLine({ node, prefix, isLast, selectedIndex }: TreeLineProps) {
  const connector = prefix === '' ? '' : (isLast ? '└─' : '├─');
  const isSelected = node.index === selectedIndex;
  const childPrefix = prefix + (prefix === '' ? '' : (isLast ? '  ' : '│ '));

  return (
    <>
      <Box>
        <Text dimColor>{prefix}{connector}</Text>
        <Text color={isSelected ? 'cyan' : 'green'}>o </Text>
        <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
          {node.agent.name}
        </Text>
      </Box>
      {node.children.map((child, i) => (
        <TreeLine
          key={child.agent.name}
          node={child}
          prefix={childPrefix}
          isLast={i === node.children.length - 1}
          selectedIndex={selectedIndex}
        />
      ))}
    </>
  );
}

export function HierarchyTree({ agents, selectedIndex }: HierarchyTreeProps) {
  const roots = buildTree(agents);

  return (
    <Box flexDirection="column">
      <Text bold dimColor>HIERARCHY</Text>
      <Box flexDirection="column" marginTop={1}>
        {roots.map((root, i) => (
          <TreeLine
            key={root.agent.name}
            node={root}
            prefix=""
            isLast={i === roots.length - 1}
            selectedIndex={selectedIndex}
          />
        ))}
      </Box>
    </Box>
  );
}
