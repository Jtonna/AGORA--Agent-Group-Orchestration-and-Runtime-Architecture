import { FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import {
  UNKNOWN_PARAMETER, DUPLICATE_PARAMETER, UNSUPPORTED_MEDIA_TYPE,
  INVALID_JSON, MISSING_VIEWER, INVALID_VIEWER, INVALID_PAGE,
  INVALID_UUID, INVALID_NAME, UNKNOWN_FIELD, MISSING_FIELD, INVALID_FIELD,
} from '../errors.js';
import { normalizeName, validateUuid, checkUnknownFields } from '../models.js';
import { validatePageNumber, PaginationError } from '../services.js';

/**
 * Validate query parameters against an allowed list.
 * Checks for unknown and duplicate parameters.
 */
export function validateQueryParams(request: FastifyRequest, allowed: string[]): void {
  // Parse the raw query string to detect duplicates
  const rawQuery = request.url.split('?')[1] || '';
  const paramCounts = new Map<string, number>();

  if (rawQuery) {
    const pairs = rawQuery.split('&');
    for (const pair of pairs) {
      const key = decodeURIComponent(pair.split('=')[0]);
      if (key) {
        paramCounts.set(key, (paramCounts.get(key) || 0) + 1);
      }
    }
  }

  // Check for unknown parameters
  for (const key of paramCounts.keys()) {
    if (!allowed.includes(key)) {
      throw new AppError(`Unknown query parameter: '${key}'`, UNKNOWN_PARAMETER);
    }
  }

  // Check for duplicate parameters
  for (const [key, count] of paramCounts) {
    if (count > 1) {
      throw new AppError(`Duplicate query parameter: '${key}'`, DUPLICATE_PARAMETER);
    }
  }
}

/**
 * Validate Content-Type header for POST requests.
 */
export function validateContentType(request: FastifyRequest): void {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.startsWith('application/json')) {
    throw new AppError(
      `Unsupported media type: '${contentType}'. Expected 'application/json; charset=utf-8'`,
      UNSUPPORTED_MEDIA_TYPE,
    );
  }
}

/**
 * Get and validate JSON body from request.
 */
export function getJsonBody(request: FastifyRequest): Record<string, unknown> {
  const data = request.body;
  if (data === undefined || data === null) {
    throw new AppError('Request body must be valid JSON', INVALID_JSON);
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError('Request body must be a JSON object', INVALID_JSON);
  }
  return data as Record<string, unknown>;
}

/**
 * Validate and return the viewer query parameter.
 */
export function validateViewerParam(request: FastifyRequest): string {
  const query = request.query as Record<string, string | undefined>;
  const viewer = query.viewer;
  if (viewer === undefined || viewer === null) {
    throw new AppError("Missing required 'viewer' query parameter", MISSING_VIEWER);
  }
  if (!viewer.trim()) {
    throw new AppError(`Invalid viewer: '${viewer}'`, INVALID_VIEWER);
  }
  return normalizeName(viewer);
}

/**
 * Validate and return a page query parameter.
 */
export function validatePageParam(
  request: FastifyRequest,
  paramName: string = 'page',
  defaultValue: number = 1,
): number {
  const query = request.query as Record<string, string | undefined>;
  const pageStr = query[paramName];
  if (pageStr === undefined || pageStr === null) {
    return defaultValue;
  }
  try {
    return validatePageNumber(pageStr);
  } catch (e) {
    if (e instanceof PaginationError) {
      throw new AppError(
        `Invalid page number: '${pageStr}'. Must be a positive integer.`,
        INVALID_PAGE,
      );
    }
    throw e;
  }
}

/**
 * Validate a UUID parameter.
 */
export function validateUuidParam(value: string, paramName: string = 'id'): string {
  if (!validateUuid(value)) {
    throw new AppError(`Invalid UUID format: '${value}'`, INVALID_UUID);
  }
  return value;
}

/**
 * Validate a name path parameter.
 */
export function validateNameParam(value: string): string {
  if (!value || !value.trim()) {
    throw new AppError(`Invalid name: '${value}'`, INVALID_NAME);
  }
  return normalizeName(value);
}

/**
 * Validate email creation request body.
 */
export function validateEmailBody(data: Record<string, unknown>): Record<string, unknown> {
  // Check for unknown fields
  const unknown = checkUnknownFields(data);
  if (unknown.length > 0) {
    throw new AppError(`Unknown field in request: '${unknown[0]}'`, UNKNOWN_FIELD);
  }

  // Check required fields
  const requiredFields = ['to', 'from', 'subject', 'content'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new AppError(`Missing required field: '${field}'`, MISSING_FIELD);
    }
  }

  // Validate 'to'
  const toValue = data.to;
  if (!Array.isArray(toValue)) {
    throw new AppError("Invalid value for field: 'to' - to must be an array", INVALID_FIELD);
  }
  if (toValue.length === 0) {
    throw new AppError("Invalid value for field: 'to' - to must contain at least one recipient", INVALID_FIELD);
  }
  for (const item of toValue) {
    if (typeof item !== 'string') {
      throw new AppError("Invalid value for field: 'to' - to must contain only strings", INVALID_FIELD);
    }
    if (!(item as string).trim()) {
      throw new AppError("Invalid value for field: 'to' - to contains empty or whitespace-only names", INVALID_FIELD);
    }
  }

  // Validate 'from'
  const fromValue = data.from;
  if (typeof fromValue !== 'string') {
    throw new AppError("Invalid value for field: 'from' - from must be a string", INVALID_FIELD);
  }
  if (!(fromValue as string).trim()) {
    throw new AppError("Invalid value for field: 'from' - from cannot be empty or whitespace", INVALID_FIELD);
  }

  // Validate 'subject'
  if (typeof data.subject !== 'string') {
    throw new AppError("Invalid value for field: 'subject' - subject must be a string", INVALID_FIELD);
  }

  // Validate 'content'
  if (typeof data.content !== 'string') {
    throw new AppError("Invalid value for field: 'content' - content must be a string", INVALID_FIELD);
  }

  // Validate 'isResponseTo'
  const isResponseTo = data.isResponseTo;
  if (isResponseTo !== undefined && isResponseTo !== null) {
    if (typeof isResponseTo !== 'string') {
      throw new AppError("Invalid value for field: 'isResponseTo' - isResponseTo must be a string or null", INVALID_FIELD);
    }
    if (!validateUuid(isResponseTo as string)) {
      throw new AppError(`Invalid UUID format: '${isResponseTo}'`, INVALID_UUID);
    }
  }

  return data;
}
