import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  normalizeNameList,
  validateUuid,
  generateUuid,
  generateTimestamp,
  validateName,
  validateNameList,
  Email,
  validateEmailData,
  checkUnknownFields,
  ALLOWED_EMAIL_FIELDS,
} from '../../src/server/models.js';

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------
describe('normalizeName', () => {
  it('should lowercase and trim a normal name', () => {
    expect(normalizeName('  Alice  ')).toBe('alice');
  });

  it('should handle already-normalized input', () => {
    expect(normalizeName('bob')).toBe('bob');
  });

  it('should handle mixed-case with inner spaces', () => {
    expect(normalizeName('  Carol  ')).toBe('carol');
  });

  it('should return empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('');
  });

  it('should throw on non-string input', () => {
    expect(() => normalizeName(123 as unknown as string)).toThrow('Name must be a string');
  });
});

// ---------------------------------------------------------------------------
// normalizeNameList
// ---------------------------------------------------------------------------
describe('normalizeNameList', () => {
  it('should normalize all entries', () => {
    expect(normalizeNameList(['Alice', 'BOB'])).toEqual(['alice', 'bob']);
  });

  it('should deduplicate names (case-insensitive)', () => {
    expect(normalizeNameList(['alice', 'Alice', 'ALICE'])).toEqual(['alice']);
  });

  it('should filter out empty / whitespace-only entries', () => {
    expect(normalizeNameList(['alice', '  ', '', 'bob'])).toEqual(['alice', 'bob']);
  });

  it('should preserve order of first occurrence', () => {
    expect(normalizeNameList(['Bob', 'alice', 'bob'])).toEqual(['bob', 'alice']);
  });

  it('should return empty array when all entries are whitespace', () => {
    expect(normalizeNameList(['  ', ''])).toEqual([]);
  });

  it('should throw on non-array input', () => {
    expect(() => normalizeNameList('oops' as unknown as string[])).toThrow(
      'Names must be an array',
    );
  });
});

// ---------------------------------------------------------------------------
// validateUuid
// ---------------------------------------------------------------------------
describe('validateUuid', () => {
  it('should accept a valid v4 UUID', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should accept a generated UUID', () => {
    expect(validateUuid(generateUuid())).toBe(true);
  });

  it('should reject an empty string', () => {
    expect(validateUuid('')).toBe(false);
  });

  it('should reject a random string', () => {
    expect(validateUuid('not-a-uuid')).toBe(false);
  });

  it('should reject non-string input', () => {
    expect(validateUuid(42 as unknown as string)).toBe(false);
  });

  it('should reject null', () => {
    expect(validateUuid(null as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateUuid
// ---------------------------------------------------------------------------
describe('generateUuid', () => {
  it('should return a valid UUID', () => {
    const id = generateUuid();
    expect(validateUuid(id)).toBe(true);
  });

  it('should return unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUuid()));
    expect(ids.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// generateTimestamp
// ---------------------------------------------------------------------------
describe('generateTimestamp', () => {
  it('should match ISO 8601 format without milliseconds', () => {
    const ts = generateTimestamp();
    // YYYY-MM-DDTHH:MM:SSZ
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('should end with Z (UTC)', () => {
    expect(generateTimestamp().endsWith('Z')).toBe(true);
  });

  it('should be parseable as a Date', () => {
    const ts = generateTimestamp();
    const date = new Date(ts);
    expect(date.toISOString()).toBeDefined();
    expect(Number.isNaN(date.getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Email constructor
// ---------------------------------------------------------------------------
describe('Email constructor', () => {
  const base = {
    to: ['Alice'],
    from: 'Bob',
    subject: 'Hello',
    content: 'World',
  };

  it('should normalize sender to lowercase trimmed', () => {
    const email = new Email({ ...base, from: '  BOB  ' });
    expect(email.from).toBe('bob');
  });

  it('should normalize recipients', () => {
    const email = new Email({ ...base, to: ['  Alice ', 'CAROL'] });
    expect(email.to).toEqual(['alice', 'carol']);
  });

  it('should deduplicate recipients', () => {
    const email = new Email({ ...base, to: ['Alice', 'alice', 'ALICE'] });
    expect(email.to).toEqual(['alice']);
  });

  it('should auto-generate id if not provided', () => {
    const email = new Email(base);
    expect(validateUuid(email.id)).toBe(true);
  });

  it('should auto-generate timestamp if not provided', () => {
    const email = new Email(base);
    expect(email.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('should default isResponseTo to null', () => {
    const email = new Email(base);
    expect(email.isResponseTo).toBeNull();
  });

  it('should default readBy to empty array', () => {
    const email = new Email(base);
    expect(email.readBy).toEqual([]);
  });

  it('should default deletedBy to empty array', () => {
    const email = new Email(base);
    expect(email.deletedBy).toEqual([]);
  });

  it('should throw if to is empty', () => {
    expect(() => new Email({ ...base, to: [] })).toThrow('at least one recipient');
  });

  it('should throw if to contains only whitespace entries', () => {
    expect(() => new Email({ ...base, to: ['  ', ''] })).toThrow('at least one recipient');
  });

  it('should throw if from is empty after normalization', () => {
    expect(() => new Email({ ...base, from: '  ' })).toThrow('must have a sender');
  });

  it('should throw if isResponseTo is an invalid UUID', () => {
    expect(() => new Email({ ...base, isResponseTo: 'bad-uuid' })).toThrow('Invalid UUID');
  });

  it('should accept a valid isResponseTo UUID', () => {
    const id = generateUuid();
    const email = new Email({ ...base, isResponseTo: id });
    expect(email.isResponseTo).toBe(id);
  });

  it('should normalize readBy list', () => {
    const email = new Email({ ...base, readBy: ['Alice', 'alice'] });
    expect(email.readBy).toEqual(['alice']);
  });

  it('should normalize deletedBy list', () => {
    const email = new Email({ ...base, deletedBy: ['BOB', '  bob  '] });
    expect(email.deletedBy).toEqual(['bob']);
  });
});

// ---------------------------------------------------------------------------
// Email.toDict / Email.fromDict round-trip
// ---------------------------------------------------------------------------
describe('Email toDict / fromDict round-trip', () => {
  it('should produce identical data through a round-trip', () => {
    const original = new Email({
      to: ['Alice', 'Carol'],
      from: 'Bob',
      subject: 'Test',
      content: 'Body text',
      id: generateUuid(),
      timestamp: generateTimestamp(),
      isResponseTo: null,
      readBy: ['alice'],
      deletedBy: [],
    });

    const dict = original.toDict();
    const restored = Email.fromDict(dict);

    expect(restored.toDict()).toEqual(original.toDict());
  });

  it('toDict should include all fields', () => {
    const email = new Email({
      to: ['alice'],
      from: 'bob',
      subject: 'S',
      content: 'C',
    });
    const dict = email.toDict();
    expect(dict).toHaveProperty('id');
    expect(dict).toHaveProperty('to');
    expect(dict).toHaveProperty('from');
    expect(dict).toHaveProperty('subject');
    expect(dict).toHaveProperty('content');
    expect(dict).toHaveProperty('timestamp');
    expect(dict).toHaveProperty('isResponseTo');
    expect(dict).toHaveProperty('readBy');
    expect(dict).toHaveProperty('deletedBy');
  });

  it('fromDict should normalize names from raw data', () => {
    const raw = {
      to: ['  ALICE  '],
      from: '  BOB  ',
      subject: 'Hi',
      content: 'There',
    };
    const email = Email.fromDict(raw);
    expect(email.from).toBe('bob');
    expect(email.to).toEqual(['alice']);
  });
});

// ---------------------------------------------------------------------------
// Email.getParticipants
// ---------------------------------------------------------------------------
describe('Email.getParticipants', () => {
  it('should include sender and all recipients', () => {
    const email = new Email({
      to: ['Alice', 'Carol'],
      from: 'Bob',
      subject: 'S',
      content: 'C',
    });
    const participants = email.getParticipants();
    expect(participants).toEqual(new Set(['alice', 'carol', 'bob']));
  });

  it('should not duplicate if sender is also a recipient', () => {
    const email = new Email({
      to: ['Bob', 'Carol'],
      from: 'Bob',
      subject: 'S',
      content: 'C',
    });
    const participants = email.getParticipants();
    expect(participants.size).toBe(2);
    expect(participants.has('bob')).toBe(true);
    expect(participants.has('carol')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Email.isParticipant
// ---------------------------------------------------------------------------
describe('Email.isParticipant', () => {
  const email = new Email({
    to: ['Alice'],
    from: 'Bob',
    subject: 'S',
    content: 'C',
  });

  it('should return true for the sender', () => {
    expect(email.isParticipant('Bob')).toBe(true);
  });

  it('should return true for a recipient', () => {
    expect(email.isParticipant('alice')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(email.isParticipant('ALICE')).toBe(true);
    expect(email.isParticipant('  bob  ')).toBe(true);
  });

  it('should return false for a non-participant', () => {
    expect(email.isParticipant('carol')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Email.markReadBy / Email.markDeletedBy
// ---------------------------------------------------------------------------
describe('Email.markReadBy', () => {
  it('should add a normalized name to readBy', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    email.markReadBy('Alice');
    expect(email.readBy).toContain('alice');
  });

  it('should not duplicate on repeated calls', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    email.markReadBy('alice');
    email.markReadBy('Alice');
    email.markReadBy('  ALICE  ');
    expect(email.readBy.filter((n) => n === 'alice').length).toBe(1);
  });
});

describe('Email.markDeletedBy', () => {
  it('should add a normalized name to deletedBy', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    email.markDeletedBy('Bob');
    expect(email.deletedBy).toContain('bob');
  });

  it('should not duplicate on repeated calls', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    email.markDeletedBy('bob');
    email.markDeletedBy('BOB');
    email.markDeletedBy(' Bob ');
    expect(email.deletedBy.filter((n) => n === 'bob').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Email.isDeletedFor
// ---------------------------------------------------------------------------
describe('Email.isDeletedFor', () => {
  it('should return true after markDeletedBy', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    email.markDeletedBy('a');
    expect(email.isDeletedFor('a')).toBe(true);
  });

  it('should return false for a user who has not deleted', () => {
    const email = new Email({ to: ['a'], from: 'b', subject: 's', content: 'c' });
    expect(email.isDeletedFor('a')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkUnknownFields
// ---------------------------------------------------------------------------
describe('checkUnknownFields', () => {
  it('should return empty array for allowed fields only', () => {
    const data = { to: [], from: '', subject: '', content: '' };
    expect(checkUnknownFields(data)).toEqual([]);
  });

  it('should detect unknown fields', () => {
    const data = { to: [], from: '', subject: '', content: '', foo: 1, bar: 2 };
    const unknown = checkUnknownFields(data);
    expect(unknown).toContain('foo');
    expect(unknown).toContain('bar');
    expect(unknown.length).toBe(2);
  });

  it('should allow the isResponseTo field', () => {
    const data = { to: [], from: '', subject: '', content: '', isResponseTo: null };
    expect(checkUnknownFields(data)).toEqual([]);
  });

  it('should flag id as unknown (not in ALLOWED_EMAIL_FIELDS)', () => {
    const data = { to: [], from: '', subject: '', content: '', id: '123' };
    expect(checkUnknownFields(data)).toContain('id');
  });
});

// ---------------------------------------------------------------------------
// validateEmailData
// ---------------------------------------------------------------------------
describe('validateEmailData', () => {
  const valid = {
    to: ['alice'],
    from: 'bob',
    subject: 'Hi',
    content: 'Hello there',
  };

  it('should return no errors for valid data', () => {
    expect(validateEmailData(valid)).toEqual([]);
  });

  it('should report missing required fields', () => {
    const errors = validateEmailData({});
    expect(errors).toContain("Missing required field: 'to'");
    expect(errors).toContain("Missing required field: 'from'");
    expect(errors).toContain("Missing required field: 'subject'");
    expect(errors).toContain("Missing required field: 'content'");
  });

  it('should report to field not being an array', () => {
    const errors = validateEmailData({ ...valid, to: 'alice' });
    expect(errors.some((e) => e.includes("'to' must be a list"))).toBe(true);
  });

  it('should report empty to array', () => {
    const errors = validateEmailData({ ...valid, to: [] });
    expect(errors.some((e) => e.includes('at least one recipient'))).toBe(true);
  });

  it('should report non-string recipients', () => {
    const errors = validateEmailData({ ...valid, to: [123] });
    expect(errors.some((e) => e.includes('must be a string'))).toBe(true);
  });

  it('should report empty-string recipients', () => {
    const errors = validateEmailData({ ...valid, to: ['  '] });
    expect(errors.some((e) => e.includes('cannot be empty'))).toBe(true);
  });

  it('should report from field not being a string', () => {
    const errors = validateEmailData({ ...valid, from: 42 });
    expect(errors.some((e) => e.includes("'from' must be a string"))).toBe(true);
  });

  it('should report empty from', () => {
    const errors = validateEmailData({ ...valid, from: '  ' });
    expect(errors.some((e) => e.includes("'from' cannot be empty"))).toBe(true);
  });

  it('should report subject not being a string', () => {
    const errors = validateEmailData({ ...valid, subject: 42 });
    expect(errors.some((e) => e.includes("'subject' must be a string"))).toBe(true);
  });

  it('should report content not being a string', () => {
    const errors = validateEmailData({ ...valid, content: 42 });
    expect(errors.some((e) => e.includes("'content' must be a string"))).toBe(true);
  });

  it('should report invalid isResponseTo UUID', () => {
    const errors = validateEmailData({ ...valid, isResponseTo: 'bad' });
    expect(errors.some((e) => e.includes('valid UUID'))).toBe(true);
  });

  it('should accept null isResponseTo', () => {
    const errors = validateEmailData({ ...valid, isResponseTo: null });
    expect(errors).toEqual([]);
  });

  it('should accept a valid isResponseTo UUID', () => {
    const errors = validateEmailData({ ...valid, isResponseTo: generateUuid() });
    expect(errors).toEqual([]);
  });

  it('should report isResponseTo of wrong type', () => {
    const errors = validateEmailData({ ...valid, isResponseTo: 42 });
    expect(errors.some((e) => e.includes("'isResponseTo' must be a string or null"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateName / validateNameList (bonus coverage)
// ---------------------------------------------------------------------------
describe('validateName', () => {
  it('should return true for a valid name', () => {
    expect(validateName('alice')).toBe(true);
  });

  it('should return true for a name with extra whitespace', () => {
    expect(validateName('  Bob  ')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(validateName('')).toBe(false);
  });

  it('should return false for whitespace-only', () => {
    expect(validateName('   ')).toBe(false);
  });

  it('should return false for non-string', () => {
    expect(validateName(42 as unknown as string)).toBe(false);
  });
});

describe('validateNameList', () => {
  it('should return true for a valid list', () => {
    expect(validateNameList(['alice', 'bob'])).toBe(true);
  });

  it('should return false for an empty list', () => {
    expect(validateNameList([])).toBe(false);
  });

  it('should return false if any name is invalid', () => {
    expect(validateNameList(['alice', ''])).toBe(false);
  });

  it('should return false for non-array', () => {
    expect(validateNameList('oops' as unknown as string[])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ALLOWED_EMAIL_FIELDS constant
// ---------------------------------------------------------------------------
describe('ALLOWED_EMAIL_FIELDS', () => {
  it('should contain the five expected fields', () => {
    expect(ALLOWED_EMAIL_FIELDS.has('to')).toBe(true);
    expect(ALLOWED_EMAIL_FIELDS.has('from')).toBe(true);
    expect(ALLOWED_EMAIL_FIELDS.has('subject')).toBe(true);
    expect(ALLOWED_EMAIL_FIELDS.has('content')).toBe(true);
    expect(ALLOWED_EMAIL_FIELDS.has('isResponseTo')).toBe(true);
    expect(ALLOWED_EMAIL_FIELDS.size).toBe(5);
  });
});
