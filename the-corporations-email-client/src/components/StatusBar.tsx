import React from 'react';
import { Box, Text } from 'ink';
import type { ViewType } from '../types/email.js';

interface StatusBarProps {
  view: ViewType;
  apiConnected: boolean;
  lastRefresh: Date | null;
  loading?: boolean;
}

function getViewControls(view: ViewType): React.ReactNode {
  switch (view) {
    case 'dashboard':
      return (
        <>
          <Text dimColor>[</Text>
          <Text bold>R</Text>
          <Text dimColor>] Refresh  </Text>
          <Text dimColor>[</Text>
          <Text bold>1-3</Text>
          <Text dimColor>] View Agent  </Text>
          <Text dimColor>[</Text>
          <Text bold color="green">C</Text>
          <Text dimColor>] Compose  </Text>
          <Text dimColor>[</Text>
          <Text bold color="red">Q</Text>
          <Text dimColor>] Quit</Text>
        </>
      );
    case 'agent-detail':
      return (
        <>
          <Text dimColor>[</Text>
          <Text bold>↑/↓</Text>
          <Text dimColor>] Navigate  </Text>
          <Text dimColor>[</Text>
          <Text bold color="green">Enter</Text>
          <Text dimColor>] View Email  </Text>
          <Text dimColor>[</Text>
          <Text bold>R</Text>
          <Text dimColor>] Refresh  </Text>
          <Text dimColor>[</Text>
          <Text bold color="cyan">B</Text>
          <Text dimColor>] Back  </Text>
          <Text dimColor>[</Text>
          <Text bold color="red">Q</Text>
          <Text dimColor>] Quit</Text>
        </>
      );
    case 'email-detail':
      return (
        <>
          <Text dimColor>[</Text>
          <Text bold color="green">R</Text>
          <Text dimColor>] Reply  </Text>
          <Text dimColor>[</Text>
          <Text bold color="cyan">B</Text>
          <Text dimColor>] Back  </Text>
          <Text dimColor>[</Text>
          <Text bold color="red">Q</Text>
          <Text dimColor>] Quit</Text>
        </>
      );
    case 'compose':
      return (
        <>
          <Text dimColor>[</Text>
          <Text bold color="green">Ctrl+S</Text>
          <Text dimColor>] Send  </Text>
          <Text dimColor>[</Text>
          <Text bold>Tab/↓</Text>
          <Text dimColor>] Next Field  </Text>
          <Text dimColor>[</Text>
          <Text bold color="red">Esc</Text>
          <Text dimColor>] Cancel</Text>
        </>
      );
    default:
      return null;
  }
}

function formatTime(date: Date | null): string {
  if (!date) return '--:--:--';
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function StatusBar({ view, apiConnected, lastRefresh, loading }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      justifyContent="space-between"
      paddingX={1}
    >
      <Box>{getViewControls(view)}</Box>

      <Box>
        {loading && (
          <>
            <Text color="yellow">Loading...</Text>
            <Text>  </Text>
          </>
        )}
        <Text dimColor>Last: {formatTime(lastRefresh)}  </Text>
        <Text dimColor>API: </Text>
        {apiConnected ? (
          <>
            <Text color="green">●</Text>
            <Text color="green"> Connected</Text>
          </>
        ) : (
          <>
            <Text color="red">●</Text>
            <Text color="red"> Disconnected</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
