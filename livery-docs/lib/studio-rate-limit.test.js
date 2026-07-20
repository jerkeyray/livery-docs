import { describe, expect, test } from 'bun:test';
import { extractClientAddress, hashStudioClient, takeStudioRateLimit } from './studio-rate-limit';

const request = new Request('https://livery.jerkeyray.com/api/chat', {
  headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
});

describe('Studio rate limiting', () => {
  test('extracts only the first forwarded address and hashes it deterministically', () => {
    expect(extractClientAddress(request)).toBe('203.0.113.9');
    const hashed = hashStudioClient('203.0.113.9', 'test-salt');
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain('203.0.113.9');
    expect(hashed).toBe(hashStudioClient('203.0.113.9', 'test-salt'));
  });

  test('checks per-minute, per-day, and global quotas with no raw address', async () => {
    const calls = [];
    const backend = {
      async limit(scope, identifier) {
        calls.push([scope, identifier]);
        return { success: true, reset: 2_000 };
      },
    };
    expect(await takeStudioRateLimit(request, { backend, now: 1_000, env: { NODE_ENV: 'test', STUDIO_RATE_LIMIT_SALT: 'salt' } })).toEqual({ allowed: true, retryAfter: 0 });
    expect(calls.map(([scope]) => scope)).toEqual(['minute', 'daily', 'global']);
    expect(calls.slice(0, 2).every(([, identifier]) => !identifier.includes('203.0.113.9'))).toBe(true);
    expect(calls[2]).toEqual(['global', 'hosted-generations']);
  });

  test('returns a consistent retry window when a quota is exhausted', async () => {
    const result = await takeStudioRateLimit(request, {
      now: 1_000,
      env: { NODE_ENV: 'test', STUDIO_RATE_LIMIT_SALT: 'salt' },
      backend: { limit: async () => ({ success: false, reset: 61_000 }) },
    });
    expect(result).toMatchObject({ allowed: false, status: 429, retryAfter: 60 });
  });

  test('fails closed in production without durable configuration', async () => {
    const result = await takeStudioRateLimit(request, { env: { NODE_ENV: 'production' } });
    expect(result).toMatchObject({ allowed: false, status: 503 });
  });
});
