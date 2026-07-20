import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitScope = 'minute' | 'daily' | 'global';
type LimitResult = { success: boolean; reset: number };

export type StudioRateLimitBackend = {
  limit(scope: LimitScope, identifier: string): Promise<LimitResult>;
};

export type StudioRateLimitResult =
  | { allowed: true; retryAfter: 0 }
  | { allowed: false; retryAfter: number; status: 429 | 503; message: string };

const LIMITS = {
  minute: { requests: 6, windowMs: 60_000 },
  daily: { requests: 25, windowMs: 86_400_000 },
  global: { requests: 500, windowMs: 86_400_000 },
} as const;

let durableBackend: StudioRateLimitBackend | undefined;
type MemoryEntry = { count: number; reset: number };
const memoryEntries = new Map<string, MemoryEntry>();

export async function takeStudioRateLimit(
  request: Request,
  options: {
    env?: NodeJS.ProcessEnv;
    now?: number;
    backend?: StudioRateLimitBackend;
  } = {},
): Promise<StudioRateLimitResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const isProduction = env.NODE_ENV === 'production';
  const salt = env.STUDIO_RATE_LIMIT_SALT;
  const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

  if (isProduction && (!salt || !hasRedis) && !options.backend) {
    return {
      allowed: false,
      retryAfter: 60,
      status: 503,
      message: 'Studio generation is temporarily unavailable because capacity controls are not configured.',
    };
  }

  const client = hashStudioClient(extractClientAddress(request), salt ?? 'livery-local-development');
  const backend = options.backend
    ?? (hasRedis ? getDurableBackend(env) : createMemoryBackend(now));

  try {
    for (const [scope, identifier] of [
      ['minute', client],
      ['daily', client],
      ['global', 'hosted-generations'],
    ] as const) {
      const result = await backend.limit(scope, identifier);
      if (!result.success) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((result.reset - now) / 1_000)),
          status: 429,
          message: scope === 'global'
            ? 'Livery Studio has reached today’s hosted generation capacity. Try again after the daily reset.'
            : 'You have reached the Studio generation limit. Try again after the limit resets.',
        };
      }
    }
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    console.error('[studio] durable rate limit failed:', error);
    if (isProduction) {
      return {
        allowed: false,
        retryAfter: 60,
        status: 503,
        message: 'Studio generation is temporarily unavailable while capacity controls recover.',
      };
    }
    return { allowed: true, retryAfter: 0 };
  }
}

export function hashStudioClient(address: string, salt: string): string {
  return createHmac('sha256', salt).update(address).digest('hex');
}

export function extractClientAddress(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function getDurableBackend(env: NodeJS.ProcessEnv): StudioRateLimitBackend {
  if (durableBackend) return durableBackend;
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const limiters = {
    minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, '1 m'), prefix: 'livery:studio:minute' }),
    daily: new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(25, '1 d'), prefix: 'livery:studio:daily' }),
    global: new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(500, '1 d'), prefix: 'livery:studio:global' }),
  };
  durableBackend = {
    async limit(scope, identifier) {
      const result = await limiters[scope].limit(identifier);
      return { success: result.success, reset: result.reset };
    },
  };
  return durableBackend;
}

function createMemoryBackend(now: number): StudioRateLimitBackend {
  return {
    async limit(scope, identifier) {
      const config = LIMITS[scope];
      const key = `${scope}:${identifier}`;
      const current = memoryEntries.get(key);
      if (!current || current.reset <= now) {
        const reset = now + config.windowMs;
        memoryEntries.set(key, { count: 1, reset });
        pruneMemoryEntries(now);
        return { success: true, reset };
      }
      if (current.count >= config.requests) return { success: false, reset: current.reset };
      current.count += 1;
      return { success: true, reset: current.reset };
    },
  };
}

function pruneMemoryEntries(now: number) {
  if (memoryEntries.size <= 5_000) return;
  for (const [key, entry] of memoryEntries) {
    if (entry.reset <= now) memoryEntries.delete(key);
  }
}
