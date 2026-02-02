/**
 * Email model and validation functions for the-corporations-email server.
 */

import { validate as uuidValidate } from 'uuid';

// ---------------------------------------------------------------------------
// Standalone utility functions
// ---------------------------------------------------------------------------

/**
 * Normalize a name by converting to lowercase and trimming whitespace.
 *
 * @param name - The name to normalize
 * @returns Normalized name (lowercase, trimmed)
 */
export function normalizeName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error(`Name must be a string, got ${typeof name}`);
  }
  return name.trim().toLowerCase();
}

/**
 * Normalize a list of names and remove duplicates while preserving order.
 *
 * @param names - List of names to normalize
 * @returns List of normalized, deduplicated names
 */
export function normalizeNameList(names: string[]): string[] {
  if (!Array.isArray(names)) {
    throw new Error(`Names must be an array, got ${typeof names}`);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const normalized = normalizeName(name);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Validate that a string is a valid UUID.
 *
 * @param value - String to validate
 * @returns True if valid UUID, false otherwise
 */
export function validateUuid(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return uuidValidate(value);
}

/**
 * Generate a new UUID string.
 *
 * @returns A new UUID as a string
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Generate an ISO 8601 UTC timestamp with Z suffix (no milliseconds).
 *
 * Format: YYYY-MM-DDTHH:MM:SSZ
 *
 * @returns Current UTC timestamp in ISO 8601 format with Z suffix
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Validate that a name is valid (non-empty string after normalization).
 *
 * @param name - Name to validate
 * @returns True if valid, false otherwise
 */
export function validateName(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  }
  const normalized = name.trim().toLowerCase();
  return normalized.length > 0;
}

/**
 * Validate that all names in a list are valid.
 *
 * @param names - List of names to validate
 * @returns True if all valid, false otherwise
 */
export function validateNameList(names: string[]): boolean {
  if (!Array.isArray(names)) {
    return false;
  }
  if (names.length === 0) {
    return false;
  }
  return names.every((name) => validateName(name));
}

// ---------------------------------------------------------------------------
// EmailData interface — matches the JSON wire format
// ---------------------------------------------------------------------------

/** Plain data shape for an email as serialized to / deserialized from JSON. */
export interface EmailData {
  id: string;
  to: string[];
  from: string;
  subject: string;
  content: string;
  timestamp: string;
  isResponseTo: string | null;
  readBy: string[];
  deletedBy: string[];
}

// ---------------------------------------------------------------------------
// Email class
// ---------------------------------------------------------------------------

/**
 * Email model representing an email message.
 *
 * The constructor normalizes all name fields (strip + lowercase) and
 * validates required fields, matching the behaviour of the Python dataclass.
 */
export class Email {
  public id: string;
  public to: string[];
  public from: string;
  public subject: string;
  public content: string;
  public timestamp: string;
  public isResponseTo: string | null;
  public readBy: string[];
  public deletedBy: string[];

  constructor(data: {
    to: string[];
    from: string;
    subject: string;
    content: string;
    id?: string;
    timestamp?: string;
    isResponseTo?: string | null;
    readBy?: string[];
    deletedBy?: string[];
  }) {
    // Assign with defaults
    this.id = data.id ?? generateUuid();
    this.timestamp = data.timestamp ?? generateTimestamp();
    this.isResponseTo = data.isResponseTo ?? null;
    this.subject = data.subject;
    this.content = data.content;

    // Normalize sender
    this.from = normalizeName(data.from);

    // Normalize and deduplicate recipients
    this.to = normalizeNameList(data.to);

    // Normalize and deduplicate read_by / deleted_by
    this.readBy = data.readBy ? normalizeNameList(data.readBy) : [];
    this.deletedBy = data.deletedBy ? normalizeNameList(data.deletedBy) : [];

    // --- Validation (mirrors Python __post_init__) ---
    if (this.to.length === 0) {
      throw new Error('Email must have at least one recipient');
    }
    if (!this.from) {
      throw new Error('Email must have a sender');
    }
    if (typeof this.subject !== 'string') {
      throw new Error('Subject must be a string');
    }
    if (typeof this.content !== 'string') {
      throw new Error('Content must be a string');
    }
    if (this.isResponseTo !== null) {
      if (!validateUuid(this.isResponseTo)) {
        throw new Error(`Invalid UUID for isResponseTo: ${this.isResponseTo}`);
      }
    }
  }

  /**
   * Convert Email to a plain object suitable for JSON serialization.
   *
   * @returns Plain object representation of the email
   */
  toDict(): EmailData {
    return {
      id: this.id,
      to: this.to,
      from: this.from,
      subject: this.subject,
      content: this.content,
      timestamp: this.timestamp,
      isResponseTo: this.isResponseTo,
      readBy: this.readBy,
      deletedBy: this.deletedBy,
    };
  }

  /**
   * Create an Email instance from a raw data object (e.g. parsed JSON).
   *
   * @param data - Plain object containing email fields
   * @returns New Email instance
   */
  static fromDict(data: Record<string, unknown>): Email {
    return new Email({
      id: (data.id as string | undefined) ?? generateUuid(),
      to: (data.to as string[] | undefined) ?? [],
      from: (data.from as string | undefined) ?? '',
      subject: (data.subject as string | undefined) ?? '',
      content: (data.content as string | undefined) ?? '',
      timestamp: (data.timestamp as string | undefined) ?? generateTimestamp(),
      isResponseTo: (data.isResponseTo as string | null | undefined) ?? null,
      readBy: (data.readBy as string[] | undefined) ?? [],
      deletedBy: (data.deletedBy as string[] | undefined) ?? [],
    });
  }

  /**
   * Get all participants in this email (sender + recipients).
   *
   * @returns Set of all participant names (normalized)
   */
  getParticipants(): Set<string> {
    const participants = new Set<string>(this.to);
    participants.add(this.from);
    return participants;
  }

  /**
   * Check if a name is a participant in this email.
   *
   * @param name - Name to check
   * @returns True if participant, false otherwise
   */
  isParticipant(name: string): boolean {
    const normalized = normalizeName(name);
    return this.getParticipants().has(normalized);
  }

  /**
   * Check if email is deleted for a specific user.
   *
   * @param name - Name to check
   * @returns True if deleted for user, false otherwise
   */
  isDeletedFor(name: string): boolean {
    const normalized = normalizeName(name);
    return this.deletedBy.includes(normalized);
  }

  /**
   * Mark email as read by a user.
   *
   * @param name - Name of user who read the email
   */
  markReadBy(name: string): void {
    const normalized = normalizeName(name);
    if (!this.readBy.includes(normalized)) {
      this.readBy.push(normalized);
    }
  }

  /**
   * Mark email as deleted by a user.
   *
   * @param name - Name of user who deleted the email
   */
  markDeletedBy(name: string): void {
    const normalized = normalizeName(name);
    if (!this.deletedBy.includes(normalized)) {
      this.deletedBy.push(normalized);
    }
  }
}

// ---------------------------------------------------------------------------
// Request-level validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate email data from a request body.
 *
 * @param data - Object containing email data
 * @returns List of validation error messages (empty if valid)
 */
export function validateEmailData(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  // Check required fields
  const requiredFields = ['to', 'from', 'subject', 'content'];
  for (const fieldName of requiredFields) {
    if (!(fieldName in data)) {
      errors.push(`Missing required field: '${fieldName}'`);
    }
  }

  // Validate 'to' field
  if ('to' in data) {
    if (!Array.isArray(data.to)) {
      errors.push("Field 'to' must be a list");
    } else if ((data.to as unknown[]).length === 0) {
      errors.push("Field 'to' must contain at least one recipient");
    } else {
      (data.to as unknown[]).forEach((recipient, i) => {
        if (typeof recipient !== 'string') {
          errors.push(`Recipient at index ${i} must be a string`);
        } else if (!recipient.trim()) {
          errors.push(`Recipient at index ${i} cannot be empty`);
        }
      });
    }
  }

  // Validate 'from' field
  if ('from' in data) {
    if (typeof data.from !== 'string') {
      errors.push("Field 'from' must be a string");
    } else if (!(data.from as string).trim()) {
      errors.push("Field 'from' cannot be empty");
    }
  }

  // Validate 'subject' field
  if ('subject' in data) {
    if (typeof data.subject !== 'string') {
      errors.push("Field 'subject' must be a string");
    }
  }

  // Validate 'content' field
  if ('content' in data) {
    if (typeof data.content !== 'string') {
      errors.push("Field 'content' must be a string");
    }
  }

  // Validate optional 'isResponseTo' field
  if ('isResponseTo' in data && data.isResponseTo !== null) {
    if (typeof data.isResponseTo !== 'string') {
      errors.push("Field 'isResponseTo' must be a string or null");
    } else if (!validateUuid(data.isResponseTo as string)) {
      errors.push("Field 'isResponseTo' must be a valid UUID");
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Allowed fields constant
// ---------------------------------------------------------------------------

/** Set of field names allowed in an email creation request. */
export const ALLOWED_EMAIL_FIELDS: ReadonlySet<string> = new Set([
  'to',
  'from',
  'subject',
  'content',
  'isResponseTo',
]);

/**
 * Check for unknown fields in request data.
 *
 * @param data - Object containing request data
 * @returns List of unknown field names
 */
export function checkUnknownFields(data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((key) => !ALLOWED_EMAIL_FIELDS.has(key));
}
