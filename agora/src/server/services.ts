/**
 * Business logic layer for the-corporations-email server.
 *
 * This module provides services for:
 * - Inbox filtering (agora-12)
 * - Thread building (agora-13)
 * - Pagination helpers (agora-14)
 * - Read/delete status management (agora-15)
 * - Agent discovery
 */

import { Email, normalizeName } from './models.js';
import { getStorage } from './storage.js';

// ============================================================================
// Storage interface (minimal shape needed by services)
// ============================================================================

interface EmailStorageLike {
  getAll(): Email[];
  getById(id: string): Email | null;
  update(email: Email): Email | null;
  getRegisteredAgentNames(): string[];
}

// ============================================================================
// agora-12: Inbox Filtering Service
// ============================================================================

/**
 * Get all emails visible to a viewer (inbox).
 *
 * Filtering logic:
 * - Include emails where viewer is in 'to' array OR viewer matches 'from' (case-insensitive)
 * - Exclude emails where viewer is in 'deletedBy' array
 * - Sort by timestamp descending (most recent first)
 *
 * @param viewer - The viewer's name (will be normalized to lowercase)
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns List of Email objects visible to the viewer, sorted by timestamp descending
 */
export function getInboxForViewer(viewer: string, storage?: EmailStorageLike): Email[] {
  const store = storage ?? getStorage();

  // Normalize viewer name for case-insensitive comparison
  const normalizedViewer = normalizeName(viewer);

  // Get all emails
  const allEmails = store.getAll();

  // Filter emails for this viewer
  const visibleEmails: Email[] = [];
  for (const email of allEmails) {
    // Check if viewer is a participant (in 'to' or is the sender)
    const isRecipient = email.to.includes(normalizedViewer);
    const isSender = normalizedViewer === email.from;

    // Check if viewer has deleted this email
    const isDeleted = email.deletedBy.includes(normalizedViewer);

    // Include if participant and not deleted
    if ((isRecipient || isSender) && !isDeleted) {
      visibleEmails.push(email);
    }
  }

  // Sort by timestamp descending (most recent first)
  visibleEmails.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));

  return visibleEmails;
}

/**
 * Filter a list of emails for a specific viewer.
 *
 * This is a utility function that applies the same filtering logic
 * as getInboxForViewer but on a provided list of emails.
 *
 * @param emails - List of Email objects to filter
 * @param viewer - The viewer's name (will be normalized to lowercase)
 * @returns Filtered list of Email objects visible to the viewer
 */
export function filterEmailsForViewer(emails: Email[], viewer: string): Email[] {
  const normalizedViewer = normalizeName(viewer);

  const visibleEmails: Email[] = [];
  for (const email of emails) {
    const isRecipient = email.to.includes(normalizedViewer);
    const isSender = normalizedViewer === email.from;
    const isDeleted = email.deletedBy.includes(normalizedViewer);

    if ((isRecipient || isSender) && !isDeleted) {
      visibleEmails.push(email);
    }
  }

  return visibleEmails;
}

// ============================================================================
// agora-13: Thread Building Service
// ============================================================================

/**
 * Find the root email of a thread by following isResponseTo chain upward.
 *
 * Uses iteration (not recursion) to avoid stack overflow.
 * Uses a visited set to detect cycles (defensive - stops traversal if corruption).
 *
 * @param emailId - Starting email UUID
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns Root Email object, or null if starting email not found
 */
export function findThreadRoot(emailId: string, storage?: EmailStorageLike): Email | null {
  const store = storage ?? getStorage();

  let currentEmail = store.getById(emailId);
  if (currentEmail === null) {
    return null;
  }

  const visited = new Set<string>();
  visited.add(currentEmail.id);

  // Follow isResponseTo chain upward until we find root (no parent)
  while (currentEmail.isResponseTo !== null) {
    const parentId = currentEmail.isResponseTo;

    // Cycle detection
    if (visited.has(parentId)) {
      // Corruption detected - stop traversal and return current as root
      break;
    }

    const parentEmail = store.getById(parentId);
    if (parentEmail === null) {
      // Parent not found - current email is effectively the root
      break;
    }

    visited.add(parentId);
    currentEmail = parentEmail;
  }

  return currentEmail;
}

/**
 * Find all descendants (replies) of a thread starting from root.
 *
 * Scans all emails for those with isResponseTo pointing to any email in thread.
 * Uses a fixed-point loop: keeps scanning until no new emails are added.
 *
 * @param rootId - Root email UUID
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns List of all emails in the thread (including root)
 */
export function findThreadDescendants(rootId: string, storage?: EmailStorageLike): Email[] {
  const store = storage ?? getStorage();

  const allEmails = store.getAll();

  // Build set of email IDs in thread
  const threadIds = new Set<string>();
  threadIds.add(rootId);
  const threadEmails: Email[] = [];

  // Get root email
  const rootEmail = store.getById(rootId);
  if (rootEmail) {
    threadEmails.push(rootEmail);
  }

  // Keep scanning until no new emails are added
  let changed = true;
  while (changed) {
    changed = false;
    for (const email of allEmails) {
      if (!threadIds.has(email.id) && email.isResponseTo !== null && threadIds.has(email.isResponseTo)) {
        threadIds.add(email.id);
        threadEmails.push(email);
        changed = true;
      }
    }
  }

  return threadEmails;
}

/**
 * Build complete thread for an email.
 *
 * 1. Find root email by following isResponseTo chain upward
 * 2. Find all descendants by scanning for emails with isResponseTo pointing to any email in thread
 * 3. Exclude requested email from thread array (it's in 'email' field)
 * 4. Sort by timestamp descending (newest first)
 * 5. Thread includes ALL emails regardless of delete status
 *
 * @param emailId - The email ID to build thread for
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns Tuple of [requestedEmail, threadEmails]
 */
export function buildThread(emailId: string, storage?: EmailStorageLike): [Email | null, Email[]] {
  const store = storage ?? getStorage();

  // Get the requested email
  const requestedEmail = store.getById(emailId);
  if (requestedEmail === null) {
    return [null, []];
  }

  // Find root of thread
  const root = findThreadRoot(emailId, store);
  if (root === null) {
    return [requestedEmail, []];
  }

  // Find all descendants
  const allThreadEmails = findThreadDescendants(root.id, store);

  // Exclude the requested email from thread array
  const threadEmails = allThreadEmails.filter((e) => e.id !== emailId);

  // Sort by timestamp descending (newest first)
  threadEmails.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));

  return [requestedEmail, threadEmails];
}

// ============================================================================
// agora-14: Pagination Helpers
// ============================================================================

// Page sizes for different endpoints
export const PAGE_SIZE_INBOX = 10;
export const PAGE_SIZE_THREAD = 20;
export const PAGE_SIZE_INVESTIGATION = 20;

/**
 * Exception raised for pagination validation errors.
 */
export class PaginationError extends Error {
  public code: string;

  constructor(message: string, code: string = 'INVALID_PAGE') {
    super(message);
    this.message = message;
    this.code = code;
    this.name = 'PaginationError';
  }
}

/**
 * Validate and convert page number.
 *
 * @param page - Page number to validate (can be string, number, or any)
 * @returns Validated page number as integer
 * @throws PaginationError if page is not a positive integer
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validatePageNumber(page: any): number {
  // Reject null/undefined
  if (page === null || page === undefined) {
    throw new PaginationError(`Page must be a positive integer, got ${page}`);
  }

  // Reject floats (even those like 1.0)
  if (typeof page === 'number' && !Number.isInteger(page)) {
    throw new PaginationError(`Page must be a positive integer, got ${page}`);
  }

  // For strings, reject if contains '.'
  if (typeof page === 'string' && page.includes('.')) {
    throw new PaginationError(`Page must be a positive integer, got ${page}`);
  }

  // Try to parse to integer
  const pageInt = typeof page === 'number' ? page : parseInt(String(page), 10);

  if (isNaN(pageInt)) {
    throw new PaginationError(`Page must be a positive integer, got ${page}`);
  }

  if (pageInt < 1) {
    throw new PaginationError(`Page must be a positive integer, got ${page}`);
  }

  return pageInt;
}

/** Shape of the pagination metadata object. */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/** Shape of a paginated result. */
export interface PaginatedResult<T = unknown> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Paginate a list of items.
 *
 * @param items - List of items to paginate
 * @param page - Page number (1-indexed)
 * @param perPage - Number of items per page
 * @param allowEmpty - If true, allows returning empty results for page 1
 * @returns Object with 'data' and 'pagination' keys
 * @throws PaginationError if page number is invalid or exceeds total pages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paginate(items: any[], page: number, perPage: number, allowEmpty: boolean = true): PaginatedResult {
  const totalItems = items.length;

  // Handle empty results
  if (totalItems === 0) {
    if (!allowEmpty && page !== 1) {
      throw new PaginationError(`Page ${page} exceeds total pages (1)`);
    }
    return {
      data: [],
      pagination: {
        page: 1,
        per_page: perPage,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    };
  }

  // Calculate total pages (ceiling division)
  const totalPages = Math.ceil(totalItems / perPage);

  // Validate page doesn't exceed total
  if (page > totalPages) {
    throw new PaginationError(`Page ${page} exceeds total pages (${totalPages})`);
  }

  // Calculate slice indices
  const startIdx = (page - 1) * perPage;
  const endIdx = startIdx + perPage;

  // Get page data
  const pageData = items.slice(startIdx, endIdx);

  return {
    data: pageData,
    pagination: {
      page,
      per_page: perPage,
      total_items: totalItems,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

/**
 * Paginate inbox emails (10 per page).
 *
 * @param emails - List of Email objects
 * @param page - Page number (1-indexed)
 * @returns Paginated result with Email objects converted to dicts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paginateInbox(emails: Email[], page: any): PaginatedResult {
  const validatedPage = validatePageNumber(page);
  const result = paginate(emails, validatedPage, PAGE_SIZE_INBOX);
  result.data = (result.data as Email[]).map((email) => email.toDict());
  return result;
}

/**
 * Paginate thread emails (20 per page).
 *
 * @param emails - List of Email objects
 * @param page - Page number (1-indexed)
 * @returns Paginated result with Email objects converted to dicts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paginateThread(emails: Email[], page: any): PaginatedResult {
  const validatedPage = validatePageNumber(page);
  const result = paginate(emails, validatedPage, PAGE_SIZE_THREAD);
  result.data = (result.data as Email[]).map((email) => email.toDict());
  return result;
}

/**
 * Paginate investigation results (20 per page).
 *
 * @param items - List of items to paginate
 * @param page - Page number (1-indexed)
 * @returns Paginated result (items NOT converted)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paginateInvestigation(items: any[], page: any): PaginatedResult {
  const validatedPage = validatePageNumber(page);
  return paginate(items, validatedPage, PAGE_SIZE_INVESTIGATION);
}

// ============================================================================
// agora-15: Read/Delete Status Management
// ============================================================================

/**
 * Mark an email as read by a viewer.
 *
 * Adds viewer (lowercase) to readBy array (dedupe).
 * Idempotent: marking already-read is a no-op (success).
 *
 * @param emailId - Email UUID
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns True if email exists and was marked, false if email not found
 */
export function markAsRead(emailId: string, viewer: string, storage?: EmailStorageLike): boolean {
  const store = storage ?? getStorage();

  const email = store.getById(emailId);
  if (email === null) {
    return false;
  }

  const normalizedViewer = normalizeName(viewer);

  // Use Email model's method (handles deduplication)
  email.markReadBy(normalizedViewer);

  // Persist changes
  store.update(email);

  return true;
}

/**
 * Mark an email as deleted by a viewer.
 *
 * Adds viewer (lowercase) to deletedBy array (dedupe).
 * Idempotent: marking already-deleted is a no-op (success).
 *
 * @param emailId - Email UUID
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns True if email exists and was marked, false if email not found
 */
export function markAsDeleted(emailId: string, viewer: string, storage?: EmailStorageLike): boolean {
  const store = storage ?? getStorage();

  const email = store.getById(emailId);
  if (email === null) {
    return false;
  }

  const normalizedViewer = normalizeName(viewer);

  // Use Email model's method (handles deduplication)
  email.markDeletedBy(normalizedViewer);

  // Persist changes
  store.update(email);

  return true;
}

/**
 * Check if an email has been read by a viewer.
 *
 * @param emailId - Email UUID
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns True if viewer has read the email, false if not, null if email not found
 */
export function isReadBy(emailId: string, viewer: string, storage?: EmailStorageLike): boolean | null {
  const store = storage ?? getStorage();

  const email = store.getById(emailId);
  if (email === null) {
    return null;
  }

  const normalizedViewer = normalizeName(viewer);
  return email.readBy.includes(normalizedViewer);
}

/**
 * Check if an email has been deleted by a viewer.
 *
 * @param emailId - Email UUID
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns True if viewer has deleted the email, false if not, null if email not found
 */
export function isDeletedBy(emailId: string, viewer: string, storage?: EmailStorageLike): boolean | null {
  const store = storage ?? getStorage();

  const email = store.getById(emailId);
  if (email === null) {
    return null;
  }

  const normalizedViewer = normalizeName(viewer);
  return email.deletedBy.includes(normalizedViewer);
}

/**
 * Check if an email has been read by a viewer (using Email object directly).
 *
 * @param email - Email object
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @returns True if viewer has read the email, false otherwise
 */
export function getReadStatus(email: Email, viewer: string): boolean {
  const normalizedViewer = normalizeName(viewer);
  return email.readBy.includes(normalizedViewer);
}

/**
 * Check if an email has been deleted by a viewer (using Email object directly).
 *
 * @param email - Email object
 * @param viewer - Viewer name (will be normalized to lowercase)
 * @returns True if viewer has deleted the email, false otherwise
 */
export function getDeletedStatus(email: Email, viewer: string): boolean {
  const normalizedViewer = normalizeName(viewer);
  return email.deletedBy.includes(normalizedViewer);
}

// ============================================================================
// Agent Discovery
// ============================================================================

/**
 * Get all registered agent names from the directory.
 *
 * Used for expanding "everyone" recipient to all known agents.
 *
 * @param storage - Optional storage instance (uses singleton if not provided)
 * @returns Sorted list of registered agent names
 */
export function getAllKnownAgents(storage?: EmailStorageLike): string[] {
  const store = storage ?? getStorage();
  return store.getRegisteredAgentNames().sort();
}
