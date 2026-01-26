/**
 * Mail configuration loader - parses mail.xml to extract email type prefixes
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Default fallback if mail.xml fails to load
const DEFAULT_PREFIXES = [
  'GETTING STARTED:',
  'IMPORTANT:',
  'PROGRESS:',
  'COMPLETE:',
  'BLOCKED:',
  'QUESTION:',
  'APPROVED:',
  'REVISION:',
  'ACKNOWLEDGED:',
  'COLLABORATION REQUEST:',
  'CLARIFICATION:',
  'ANNOUNCEMENT:',
  'QUITTING:',
];

export interface MailConfig {
  subjectPrefixes: string[];
}

/**
 * Parse mail.xml content to extract type prefixes
 */
function parseMailTypes(xml: string): string[] {
  const prefixes: string[] = [];
  // Match <type prefix="..."> patterns
  const regex = /<type\s+prefix="([^"]+)"/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    // Add colon suffix for display format
    prefixes.push(`${match[1]}:`);
  }

  return prefixes;
}

/**
 * Load mail configuration from mail.xml
 * Tries multiple paths and falls back to defaults if not found
 */
export function loadMailConfig(): MailConfig {
  // Try multiple paths to find mail.xml
  const possiblePaths = [
    process.env.MAIL_XML_PATH,
    resolve(process.cwd(), '../agent orchestration/agents/v3/mail.xml'),
    resolve(process.cwd(), 'agent orchestration/agents/v3/mail.xml'),
  ].filter((p): p is string => Boolean(p));

  for (const xmlPath of possiblePaths) {
    try {
      if (existsSync(xmlPath)) {
        const xml = readFileSync(xmlPath, 'utf-8');
        const prefixes = parseMailTypes(xml);
        if (prefixes.length > 0) {
          return { subjectPrefixes: prefixes };
        }
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback to defaults
  return { subjectPrefixes: DEFAULT_PREFIXES };
}
