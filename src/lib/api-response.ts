import { NextResponse } from 'next/server';

/**
 * Canonical response envelopes. All API routes go through these - no raw
 * NextResponse.json calls anywhere else in the codebase.
 *
 *   ok(data)             → 200 { data: T }
 *   err(code, msg, 4xx)  → 4xx { error: { code, message } }
 */

export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json({ data }, init);
}

export function err(
  code: string,
  message: string,
  status: number,
  init?: ResponseInit,
): Response {
  return NextResponse.json({ error: { code, message } }, { ...init, status });
}
