import { Transform } from 'class-transformer';

// Emails are case-insensitive for our purposes: store and compare lowercase.
export function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export const NormalizeEmail = () =>
  Transform(({ value }) => normalizeEmail(value));
