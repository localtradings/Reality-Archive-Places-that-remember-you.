import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FixedWindowRateLimiter,
  createSessionToken,
  isAllowedRequestOrigin,
  readJsonBodyWithLimit,
  verifySessionToken,
} from '../lib/request-security.ts';

test('creates and verifies an expiring signed demo session', () => {
  const token = createSessionToken({
    sessionId: 'session-123',
    secret: 'a-strong-test-secret-that-is-long-enough',
    issuedAtMs: 1_000,
    ttlMs: 60_000,
  });

  assert.equal(
    verifySessionToken({
      token,
      secret: 'a-strong-test-secret-that-is-long-enough',
      nowMs: 30_000,
    })?.sessionId,
    'session-123',
  );
  assert.equal(
    verifySessionToken({
      token,
      secret: 'wrong-secret-that-is-also-long-enough',
      nowMs: 30_000,
    }),
    null,
  );
  assert.equal(
    verifySessionToken({
      token,
      secret: 'a-strong-test-secret-that-is-long-enough',
      nowMs: 70_000,
    }),
    null,
  );
});

test('requires the configured same origin in production', () => {
  assert.equal(
    isAllowedRequestOrigin({
      requestOrigin: 'https://archive.example',
      configuredOrigin: 'https://archive.example',
      nodeEnv: 'production',
    }),
    true,
  );
  assert.equal(
    isAllowedRequestOrigin({
      requestOrigin: 'https://attacker.example',
      configuredOrigin: 'https://archive.example',
      nodeEnv: 'production',
    }),
    false,
  );
  assert.equal(
    isAllowedRequestOrigin({
      requestOrigin: 'https://archive.example',
      configuredOrigin: '',
      nodeEnv: 'production',
    }),
    false,
  );
});

test('rate limiter blocks requests beyond the fixed-window allowance', () => {
  const limiter = new FixedWindowRateLimiter();

  assert.equal(limiter.consume('session-1', 2, 60_000, 1_000).allowed, true);
  assert.equal(limiter.consume('session-1', 2, 60_000, 2_000).allowed, true);
  assert.equal(limiter.consume('session-1', 2, 60_000, 3_000).allowed, false);
  assert.equal(limiter.consume('session-1', 2, 60_000, 62_000).allowed, true);
});

test('rejects JSON bodies larger than the route limit', async () => {
  const request = new Request('https://archive.example/api/microsoft-iq/summaries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(256) }),
  });

  await assert.rejects(() => readJsonBodyWithLimit(request, 64), /Request body exceeds 64 bytes/);
});

