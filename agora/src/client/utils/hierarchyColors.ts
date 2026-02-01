import type { Agent } from '../types/email.js';

// UI State colors
export const SELECTION_COLOR = 'yellowBright';
export const HOVER_BORDER_COLOR = 'cyan';
export const INTERACT_BORDER_COLOR = 'yellowBright';

// Color palette by depth (0 = root/CEO)
const DEPTH_COLORS: string[] = [
  'blue',          // 0 - CEO/root
  'green',         // 1
  'yellow',        // 2
  'red',           // 3 (closest to orange)
  'magenta',       // 4
  'cyan',          // 5
  'white',         // 6
  'blueBright',    // 7
  'greenBright',   // 8
  'yellowBright',  // 9
  'redBright',     // 10
  'magentaBright', // 11
  'cyanBright',    // 12
  'whiteBright',   // 13
  'blue',          // 14 (cycle)
  'green',         // 15 (cycle)
];

/**
 * Calculate the depth of an agent in the hierarchy
 * Depth 0 = root (no supervisor or supervisor not in list)
 */
export function calculateDepth(
  agentName: string,
  agents: Agent[],
  visited: Set<string> = new Set()
): number {
  // Cycle protection
  if (visited.has(agentName.toLowerCase())) return 0;
  visited.add(agentName.toLowerCase());

  const agent = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase());
  if (!agent || !agent.supervisor) return 0;

  // Check if supervisor is in the agent list
  const supervisorInList = agents.find(
    (a) => a.name.toLowerCase() === agent.supervisor?.toLowerCase()
  );
  if (!supervisorInList) return 0;

  return 1 + calculateDepth(agent.supervisor, agents, visited);
}

/**
 * Get color for a given depth
 */
export function getDepthColor(depth: number): string {
  if (depth >= 16) return 'gray';
  return DEPTH_COLORS[depth] || 'gray';
}

/**
 * Calculate depths for all agents and return a map
 */
export function calculateAllDepths(agents: Agent[]): Map<string, number> {
  const depths = new Map<string, number>();
  for (const agent of agents) {
    depths.set(agent.name.toLowerCase(), calculateDepth(agent.name, agents));
  }
  return depths;
}
