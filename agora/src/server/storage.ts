/**
 * Storage singleton for the AGORA email server.
 *
 * Provides a JSON-file-backed storage layer with database-like methods for
 * email management.  Implements startup validation and quarantine logic.
 *
 * Ported from the-corporations-email/storage.py.
 * Node.js is single-threaded so all threading / locking / queue mechanisms
 * from the Python version have been removed in favour of synchronous fs calls.
 */

import fs from 'fs';
import path from 'path';

import {
  Email,
  EmailData,
  validateUuid,
  normalizeName,
  generateTimestamp,
} from './models.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DATA_DIR = 'data';
const DEFAULT_EMAILS_FILE = 'emails.json';
const DEFAULT_QUARANTINE_FILE = 'quarantine.json';

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

/** Base exception for storage errors. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/** Exception raised when storage cannot be initialised. */
export class StorageInitError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageInitError';
    Object.setPrototypeOf(this, StorageInitError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A quarantine entry stored alongside the original email data. */
export interface QuarantineEntry {
  original: any;
  reason: string;
  quarantined_at: string;
}

/** Agent registry record. */
export interface AgentInfo {
  pid: number | null;
  supervisor: string | null;
}

// ---------------------------------------------------------------------------
// EmailStorage class
// ---------------------------------------------------------------------------

export class EmailStorage {
  // -- Private state -------------------------------------------------------
  private dataDir: string;
  private emailsPath: string;
  private quarantinePath: string;

  private emails: Map<string, Email> = new Map();
  private quarantined: QuarantineEntry[] = [];

  // Agent directory (in-memory only, no persistence)
  private agentRegistry: Map<string, AgentInfo> = new Map();
  private registeredNames: Set<string> = new Set();

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? DEFAULT_DATA_DIR;
    this.emailsPath = path.join(this.dataDir, DEFAULT_EMAILS_FILE);
    this.quarantinePath = path.join(this.dataDir, DEFAULT_QUARANTINE_FILE);
  }

  // ========================================================================
  // File I/O helpers
  // ========================================================================

  /**
   * Read and parse a JSON file.
   *
   * @param filePath - Absolute or relative path to the JSON file.
   * @returns Parsed data, or `null` if the file does not exist.
   * @throws {StorageError} If the file exists but cannot be parsed.
   */
  private readJsonFile(filePath: string): any | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        throw new StorageError(`Invalid JSON in ${filePath}: ${e.message}`);
      }
      throw new StorageError(`Cannot read ${filePath}: ${e.message}`);
    }
  }

  /**
   * Write data to a JSON file (pretty-printed with 2-space indent).
   */
  private writeJsonFile(filePath: string, data: any): void {
    this.ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Create the data directory (and parents) if it does not exist.
   */
  private ensureDataDir(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  /**
   * Create an empty emails file and return its content.
   */
  private createEmptyEmailsFile(): any {
    const data = { version: 1, emails: [] };
    this.writeJsonFile(this.emailsPath, data);
    return data;
  }

  /**
   * Create an empty quarantine file and return its content.
   */
  private createEmptyQuarantineFile(): any {
    const data = { version: 1, quarantined: [] };
    this.writeJsonFile(this.quarantinePath, data);
    return data;
  }

  /**
   * Rename a file with a timestamped suffix for backup purposes.
   *
   * @param filePath - Path to the file to back up.
   * @param suffix   - Human-readable suffix (e.g. "old", "bak").
   * @returns Path to the backup file.
   */
  private backupFile(filePath: string, suffix: string): string {
    const timestamp = generateTimestamp().replace(/:/g, '-');
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const backupPath = path.join(dir, `${base}.${suffix}.${timestamp}`);
    fs.renameSync(filePath, backupPath);
    return backupPath;
  }

  // ========================================================================
  // Validation helpers
  // ========================================================================

  /**
   * Validate the top-level structure of a data file.
   *
   * @returns `[isValid, errorMessage]`
   */
  private validateFileStructure(
    data: any,
    fileType: 'emails' | 'quarantine',
  ): [boolean, string] {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      const actual = Array.isArray(data) ? 'array' : typeof data;
      return [false, `Expected object, got ${actual}`];
    }

    if (!('version' in data)) {
      return [false, "Missing 'version' field"];
    }

    // For quarantine files the 'quarantined' key is required.
    // For emails files the missing 'emails' key is recoverable (handled later).
    if (fileType === 'quarantine' && !('quarantined' in data)) {
      return [false, "Missing 'quarantined' field"];
    }

    return [true, ''];
  }

  /**
   * Validate the version field.
   *
   * @returns `[isValid, needsConversion]`
   *   - `isValid`        – `true` if version is `1` or `"1"`.
   *   - `needsConversion` – `true` if version is the string `"1"`.
   */
  private validateVersion(version: any): [boolean, boolean] {
    if (version === 1) {
      return [true, false];
    }
    if (version === '1') {
      return [true, true];
    }
    return [false, false];
  }

  /**
   * Validate an ISO 8601 timestamp with Z suffix.
   */
  private validateTimestamp(timestamp: string): boolean {
    if (typeof timestamp !== 'string') {
      return false;
    }
    if (!timestamp.endsWith('Z')) {
      return false;
    }
    // Must match YYYY-MM-DDTHH:MM:SSZ exactly
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    if (!iso.test(timestamp)) {
      return false;
    }
    // Verify it parses to a real date
    const d = new Date(timestamp);
    return !isNaN(d.getTime());
  }

  /**
   * Validate and potentially fix email data loaded from disk.
   *
   * This is the **startup** validation path -- different from the
   * request-level `validateEmailData` exported by `models.ts`.
   *
   * @returns `[isValid, errors, fixedData]`
   *   - `isValid`   – `true` if the email is usable (possibly after fixes).
   *   - `errors`    – List of unrecoverable error descriptions.
   *   - `fixedData` – Email data with recoverable fixes applied.
   */
  private validateEmailData(data: any): [boolean, string[], any] {
    const errors: string[] = [];
    const fixed: Record<string, any> = { ...data };

    // ---- Required fields -------------------------------------------------
    const requiredFields = ['id', 'to', 'from', 'subject', 'content', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push(`missing required field: ${field}`);
      }
    }
    if (errors.length > 0) {
      return [false, errors, fixed];
    }

    // ---- id --------------------------------------------------------------
    if (typeof data.id !== 'string') {
      errors.push("field 'id' must be a string");
    } else if (!validateUuid(data.id)) {
      errors.push(`invalid UUID format for 'id': ${data.id}`);
    }

    // ---- to --------------------------------------------------------------
    if (!Array.isArray(data.to)) {
      errors.push("field 'to' must be an array");
    } else {
      const validRecipients: string[] = [];
      for (const item of data.to) {
        if (typeof item === 'string') {
          const normalized = item.trim().toLowerCase();
          if (normalized) {
            validRecipients.push(normalized);
          }
        }
      }
      // Deduplicate while preserving order
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const name of validRecipients) {
        if (!seen.has(name)) {
          seen.add(name);
          deduped.push(name);
        }
      }
      fixed.to = deduped;

      if (fixed.to.length === 0) {
        errors.push("field 'to' must have at least one valid recipient");
      }
    }

    // ---- from ------------------------------------------------------------
    if (typeof data.from !== 'string') {
      errors.push("field 'from' must be a string");
    } else {
      fixed.from = data.from.trim().toLowerCase();
      if (!fixed.from) {
        errors.push("field 'from' cannot be empty");
      }
    }

    // ---- subject ---------------------------------------------------------
    if (typeof data.subject !== 'string') {
      errors.push("field 'subject' must be a string");
    } else {
      fixed.subject = data.subject.trim();
    }

    // ---- content ---------------------------------------------------------
    if (typeof data.content !== 'string') {
      errors.push("field 'content' must be a string");
    } else {
      fixed.content = data.content.trim();
    }

    // ---- timestamp -------------------------------------------------------
    if (!this.validateTimestamp(data.timestamp ?? '')) {
      errors.push(`invalid timestamp format: ${data.timestamp}`);
    }

    // ---- isResponseTo (optional) -----------------------------------------
    if ('isResponseTo' in data) {
      if (data.isResponseTo !== null) {
        if (typeof data.isResponseTo !== 'string') {
          errors.push("field 'isResponseTo' must be a string or null");
        } else if (!validateUuid(data.isResponseTo)) {
          errors.push(`invalid UUID format for 'isResponseTo': ${data.isResponseTo}`);
        }
      }
    }

    // ---- readBy (default [], normalise, dedupe) --------------------------
    if (!('readBy' in data)) {
      fixed.readBy = [];
    } else if (!Array.isArray(data.readBy)) {
      errors.push("field 'readBy' must be an array");
    } else {
      fixed.readBy = dedupeStringArray(data.readBy);
    }

    // ---- deletedBy (default [], normalise, dedupe) -----------------------
    if (!('deletedBy' in data)) {
      fixed.deletedBy = [];
    } else if (!Array.isArray(data.deletedBy)) {
      errors.push("field 'deletedBy' must be an array");
    } else {
      fixed.deletedBy = dedupeStringArray(data.deletedBy);
    }

    // ---- Strip extra fields not in schema --------------------------------
    const allowedFields = new Set([
      'id', 'to', 'from', 'subject', 'content', 'timestamp',
      'isResponseTo', 'readBy', 'deletedBy',
    ]);
    for (const key of Object.keys(fixed)) {
      if (!allowedFields.has(key)) {
        delete fixed[key];
      }
    }

    return [errors.length === 0, errors, fixed];
  }

  // ========================================================================
  // Quarantine helpers
  // ========================================================================

  /**
   * Append an email to the in-memory quarantine list.
   */
  private quarantineEmail(emailData: any, reason: string): void {
    const entry: QuarantineEntry = {
      original: emailData,
      reason,
      quarantined_at: generateTimestamp(),
    };
    this.quarantined.push(entry);
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  /** Save the current emails map to disk. */
  private saveEmails(): void {
    const data = {
      version: 1,
      emails: Array.from(this.emails.values()).map((e) => e.toDict()),
    };
    this.writeJsonFile(this.emailsPath, data);
  }

  /** Save the current quarantine list to disk. */
  private saveQuarantine(): void {
    const data = {
      version: 1,
      quarantined: this.quarantined,
    };
    this.writeJsonFile(this.quarantinePath, data);
  }

  // ========================================================================
  // Initialise (the full startup pipeline)
  // ========================================================================

  /**
   * Load and validate data files.  Must be called during application startup.
   *
   * @throws {StorageInitError} If emails.json is invalid and cannot be
   *   recovered.
   */
  initialize(): void {
    this.ensureDataDir();

    // ------------------------------------------------------------------
    // 1. Handle emails.json
    // ------------------------------------------------------------------
    let emailsData: any;
    try {
      emailsData = this.readJsonFile(this.emailsPath);
    } catch (e: any) {
      throw new StorageInitError(`emails.json is invalid: ${e.message}`);
    }

    if (emailsData === null) {
      // File does not exist -- create empty
      emailsData = this.createEmptyEmailsFile();
    } else {
      // Validate structure
      const [structValid, structError] = this.validateFileStructure(emailsData, 'emails');
      if (!structValid) {
        throw new StorageInitError(
          `emails.json has invalid structure: ${structError}`,
        );
      }

      // Validate version
      const [versionValid, needsConversion] = this.validateVersion(
        emailsData.version,
      );
      if (!versionValid) {
        // Unsupported version -- backup and create fresh
        this.backupFile(this.emailsPath, 'old');
        emailsData = this.createEmptyEmailsFile();
      } else if (needsConversion) {
        emailsData.version = 1;
      }
    }

    // Handle missing 'emails' key (recoverable)
    if (!('emails' in emailsData)) {
      emailsData.emails = [];
    }

    if (!Array.isArray(emailsData.emails)) {
      throw new StorageInitError(
        "emails.json 'emails' field is not an array",
      );
    }

    // ------------------------------------------------------------------
    // 2. Handle quarantine.json
    // ------------------------------------------------------------------
    let quarantineData: any;
    try {
      quarantineData = this.readJsonFile(this.quarantinePath);
    } catch (_e: any) {
      // Invalid quarantine file -- backup and create fresh
      this.backupFile(this.quarantinePath, 'bak');
      quarantineData = this.createEmptyQuarantineFile();
    }

    if (quarantineData === null) {
      quarantineData = this.createEmptyQuarantineFile();
    } else {
      const [structValid, structError] = this.validateFileStructure(
        quarantineData,
        'quarantine',
      );
      if (!structValid) {
        this.backupFile(this.quarantinePath, 'bak');
        quarantineData = this.createEmptyQuarantineFile();
      } else {
        const [versionValid, needsConversion] = this.validateVersion(
          quarantineData.version,
        );
        if (!versionValid) {
          this.backupFile(this.quarantinePath, 'bak');
          quarantineData = this.createEmptyQuarantineFile();
        } else if (needsConversion) {
          quarantineData.version = 1;
        }
      }
    }

    // Load existing quarantine entries
    this.quarantined = quarantineData.quarantined ?? [];

    // ------------------------------------------------------------------
    // 3. Two-pass email loading
    // ------------------------------------------------------------------
    const validEmails: Map<string, Email> = new Map();
    const idOccurrences: Map<string, any[]> = new Map();

    // Pass 1: group by ID to detect duplicates
    for (const emailData of emailsData.emails) {
      const emailId = emailData?.id;
      if (emailId) {
        if (!idOccurrences.has(emailId)) {
          idOccurrences.set(emailId, []);
        }
        idOccurrences.get(emailId)!.push(emailData);
      }
    }

    // Pass 2: validate and process
    for (const emailData of emailsData.emails) {
      const emailId = emailData?.id;

      // Quarantine ALL copies of a duplicate ID
      if (emailId && (idOccurrences.get(emailId)?.length ?? 0) > 1) {
        this.quarantineEmail(emailData, `duplicate id: ${emailId}`);
        continue;
      }

      // Validate and fix
      const [isValid, errors, fixedData] = this.validateEmailData(emailData);
      if (!isValid) {
        this.quarantineEmail(emailData, errors.join('; '));
        continue;
      }

      // Create Email object
      try {
        const email = new Email({
          id: fixedData.id,
          to: fixedData.to,
          from: fixedData.from,
          subject: fixedData.subject,
          content: fixedData.content,
          timestamp: fixedData.timestamp,
          isResponseTo: fixedData.isResponseTo ?? null,
          readBy: fixedData.readBy ?? [],
          deletedBy: fixedData.deletedBy ?? [],
        });
        validEmails.set(email.id, email);
      } catch (e: any) {
        this.quarantineEmail(
          emailData,
          `failed to create Email object: ${e.message}`,
        );
      }
    }

    this.emails = validEmails;

    // ------------------------------------------------------------------
    // 4. Save cleaned files
    // ------------------------------------------------------------------
    this.saveEmails();
    this.saveQuarantine();
  }

  // ========================================================================
  // Database-like public methods
  // ========================================================================

  /** Get all emails. */
  getAll(): Email[] {
    return Array.from(this.emails.values());
  }

  /** Get an email by ID, or `null` if not found. */
  getById(emailId: string): Email | null {
    return this.emails.get(emailId) ?? null;
  }

  /** Store a new email and persist to disk. */
  create(email: Email): Email {
    this.emails.set(email.id, email);
    this.saveEmails();
    return email;
  }

  /** Update an existing email and persist.  Returns `null` if not found. */
  update(email: Email): Email | null {
    if (!this.emails.has(email.id)) {
      return null;
    }
    this.emails.set(email.id, email);
    this.saveEmails();
    return email;
  }

  /** Delete an email by ID.  Returns `true` if it existed. */
  delete(emailId: string): boolean {
    if (!this.emails.has(emailId)) {
      return false;
    }
    this.emails.delete(emailId);
    this.saveEmails();
    return true;
  }

  /** Check whether an email with the given ID exists. */
  exists(emailId: string): boolean {
    return this.emails.has(emailId);
  }

  /** Get a shallow copy of the quarantine list. */
  getQuarantined(): QuarantineEntry[] {
    return [...this.quarantined];
  }

  /** Quarantine an email and persist immediately. */
  addToQuarantine(emailData: any, reason: string): void {
    this.quarantineEmail(emailData, reason);
    this.saveQuarantine();
  }

  // ========================================================================
  // Agent Directory (in-memory only)
  // ========================================================================

  /**
   * Check whether an agent name has never been registered.
   */
  isAgentNameAvailable(name: string): boolean {
    return !this.registeredNames.has(normalizeName(name));
  }

  /**
   * Register a new agent, permanently reserving the name.
   *
   * @throws {Error} If the name is already taken.
   */
  registerAgent(
    name: string,
    pid: number | null = null,
    supervisor: string | null = null,
  ): void {
    const normalized = normalizeName(name);
    if (this.registeredNames.has(normalized)) {
      throw new Error(`Agent name '${normalized}' is already taken`);
    }
    this.registeredNames.add(normalized);
    this.agentRegistry.set(normalized, {
      pid,
      supervisor: supervisor ? normalizeName(supervisor) : null,
    });
  }

  /**
   * Update an agent's PID.
   *
   * @returns `true` if the agent was found and updated, `false` otherwise.
   */
  updateAgentPid(name: string, pid: number): boolean {
    const normalized = normalizeName(name);
    if (!this.registeredNames.has(normalized)) {
      return false;
    }
    const info = this.agentRegistry.get(normalized)!;
    info.pid = pid;
    return true;
  }

  /** Get all registered agents as a plain record. */
  getAllAgents(): Record<string, AgentInfo> {
    const result: Record<string, AgentInfo> = {};
    for (const [name, info] of this.agentRegistry) {
      result[name] = { ...info };
    }
    return result;
  }

  /** Get the list of all registered agent names. */
  getRegisteredAgentNames(): string[] {
    return Array.from(this.agentRegistry.keys());
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Filter non-strings, normalise, and deduplicate a string array
 * (preserving insertion order).
 */
function dedupeStringArray(arr: any[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'string') {
      const normalized = item.trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let instance: EmailStorage | null = null;

/**
 * Get (or create) the singleton `EmailStorage` instance.
 *
 * @param dataDir - Data directory path.  Only used when the instance is first
 *   created; ignored on subsequent calls.
 */
export function getStorage(dataDir?: string): EmailStorage {
  if (instance === null) {
    instance = new EmailStorage(dataDir);
  }
  return instance;
}

/**
 * Reset the singleton instance.  Intended for testing.
 */
export function resetStorage(): void {
  instance = null;
}
