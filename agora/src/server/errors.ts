/**
 * Error codes and helpers for the AGORA server.
 *
 * Ported from the-corporations-email/errors.py
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const EMAIL_NOT_FOUND = "EMAIL_NOT_FOUND" as const;
export const EMAIL_DELETED = "EMAIL_DELETED" as const;
export const NOT_PARTICIPANT = "NOT_PARTICIPANT" as const;
export const PARENT_NOT_FOUND = "PARENT_NOT_FOUND" as const;
export const MISSING_FIELD = "MISSING_FIELD" as const;
export const INVALID_FIELD = "INVALID_FIELD" as const;
export const INVALID_JSON = "INVALID_JSON" as const;
export const INVALID_UUID = "INVALID_UUID" as const;
export const INVALID_PAGE = "INVALID_PAGE" as const;
export const INVALID_NAME = "INVALID_NAME" as const;
export const MISSING_VIEWER = "MISSING_VIEWER" as const;
export const INVALID_VIEWER = "INVALID_VIEWER" as const;
export const UNKNOWN_PARAMETER = "UNKNOWN_PARAMETER" as const;
export const DUPLICATE_PARAMETER = "DUPLICATE_PARAMETER" as const;
export const UNKNOWN_FIELD = "UNKNOWN_FIELD" as const;
export const UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE" as const;

// Agent directory errors
export const NAME_TAKEN = "NAME_TAKEN" as const;
export const AGENT_NOT_FOUND = "AGENT_NOT_FOUND" as const;

/** Union of every valid error code string. */
export type ErrorCode =
  | typeof EMAIL_NOT_FOUND
  | typeof EMAIL_DELETED
  | typeof NOT_PARTICIPANT
  | typeof PARENT_NOT_FOUND
  | typeof MISSING_FIELD
  | typeof INVALID_FIELD
  | typeof INVALID_JSON
  | typeof INVALID_UUID
  | typeof INVALID_PAGE
  | typeof INVALID_NAME
  | typeof MISSING_VIEWER
  | typeof INVALID_VIEWER
  | typeof UNKNOWN_PARAMETER
  | typeof DUPLICATE_PARAMETER
  | typeof UNKNOWN_FIELD
  | typeof UNSUPPORTED_MEDIA_TYPE
  | typeof NAME_TAKEN
  | typeof AGENT_NOT_FOUND;

// ---------------------------------------------------------------------------
// HTTP status code mapping for each error type
// ---------------------------------------------------------------------------

export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [EMAIL_NOT_FOUND]: 404,
  [EMAIL_DELETED]: 410,
  [NOT_PARTICIPANT]: 403,
  [PARENT_NOT_FOUND]: 404,
  [MISSING_FIELD]: 400,
  [INVALID_FIELD]: 400,
  [INVALID_JSON]: 400,
  [INVALID_UUID]: 400,
  [INVALID_PAGE]: 400,
  [INVALID_NAME]: 400,
  [MISSING_VIEWER]: 400,
  [INVALID_VIEWER]: 400,
  [UNKNOWN_PARAMETER]: 400,
  [DUPLICATE_PARAMETER]: 400,
  [UNKNOWN_FIELD]: 400,
  [UNSUPPORTED_MEDIA_TYPE]: 415,
  [NAME_TAKEN]: 400,
  [AGENT_NOT_FOUND]: 404,
} as const;

// ---------------------------------------------------------------------------
// Error response type
// ---------------------------------------------------------------------------

export interface ErrorResponseBody {
  error: string;
  code: ErrorCode;
}

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

/**
 * Application error that carries a machine-readable `code` and the
 * appropriate HTTP `statusCode`.  Throw this from route handlers and catch
 * it in centralised error-handling middleware.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code] ?? 400;

    // Maintain proper prototype chain for instanceof checks.
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /** Serialise to the standard JSON error envelope. */
  toJSON(): ErrorResponseBody {
    return { error: this.message, code: this.code };
  }
}

// ---------------------------------------------------------------------------
// Core factory
// ---------------------------------------------------------------------------

/**
 * Create a standardised error response object with its HTTP status code.
 *
 * This is the framework-agnostic equivalent of the Python
 * `create_error_response` helper.  Route handlers can use the returned
 * tuple directly:
 *
 * ```ts
 * const [body, status] = createErrorResponse("not found", EMAIL_NOT_FOUND);
 * res.status(status).json(body);
 * ```
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode,
): [ErrorResponseBody, number] {
  const statusCode = ERROR_STATUS_CODES[code] ?? 400;
  const body: ErrorResponseBody = { error: message, code };
  return [body, statusCode];
}

// ---------------------------------------------------------------------------
// Convenience helpers — one per error code
// ---------------------------------------------------------------------------

export function errorEmailNotFound(emailId: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Email with id '${emailId}' not found`, EMAIL_NOT_FOUND);
}

export function errorEmailDeleted(emailId: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Email with id '${emailId}' has been deleted`, EMAIL_DELETED);
}

export function errorNotParticipant(viewer: string, emailId: string): [ErrorResponseBody, number] {
  return createErrorResponse(
    `User '${viewer}' is not a participant in email '${emailId}'`,
    NOT_PARTICIPANT,
  );
}

export function errorParentNotFound(parentId: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Parent email with id '${parentId}' not found`, PARENT_NOT_FOUND);
}

export function errorMissingField(fieldName: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Missing required field: '${fieldName}'`, MISSING_FIELD);
}

export function errorInvalidField(fieldName: string, reason?: string): [ErrorResponseBody, number] {
  let message = `Invalid value for field: '${fieldName}'`;
  if (reason) {
    message += ` - ${reason}`;
  }
  return createErrorResponse(message, INVALID_FIELD);
}

export function errorInvalidJson(): [ErrorResponseBody, number] {
  return createErrorResponse("Request body must be valid JSON", INVALID_JSON);
}

export function errorInvalidUuid(value: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Invalid UUID format: '${value}'`, INVALID_UUID);
}

export function errorInvalidPage(page: unknown): [ErrorResponseBody, number] {
  return createErrorResponse(
    `Invalid page number: '${page}'. Must be a positive integer.`,
    INVALID_PAGE,
  );
}

export function errorInvalidName(name: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Invalid name: '${name}'`, INVALID_NAME);
}

export function errorMissingViewer(): [ErrorResponseBody, number] {
  return createErrorResponse("Missing required 'viewer' query parameter", MISSING_VIEWER);
}

export function errorInvalidViewer(viewer: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Invalid viewer: '${viewer}'`, INVALID_VIEWER);
}

export function errorUnknownParameter(paramName: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Unknown query parameter: '${paramName}'`, UNKNOWN_PARAMETER);
}

export function errorDuplicateParameter(paramName: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Duplicate query parameter: '${paramName}'`, DUPLICATE_PARAMETER);
}

export function errorUnknownField(fieldName: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Unknown field in request: '${fieldName}'`, UNKNOWN_FIELD);
}

export function errorUnsupportedMediaType(contentType?: string): [ErrorResponseBody, number] {
  const message = contentType
    ? `Unsupported media type: '${contentType}'. Expected 'application/json'`
    : "Content-Type must be 'application/json'";
  return createErrorResponse(message, UNSUPPORTED_MEDIA_TYPE);
}

export function errorNameTaken(name: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Agent name '${name}' is already taken`, NAME_TAKEN);
}

export function errorAgentNotFound(name: string): [ErrorResponseBody, number] {
  return createErrorResponse(`Agent '${name}' not found`, AGENT_NOT_FOUND);
}
