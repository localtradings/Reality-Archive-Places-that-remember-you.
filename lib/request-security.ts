import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const MICROSOFT_IQ_SESSION_COOKIE = 'reality_archive_iq_session';
export const MICROSOFT_IQ_CONSENT_HEADER = 'x-reality-archive-cloud-consent';
const SESSION_VERSION = 1;

interface SessionPayload {
  version: number;
  sessionId: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

interface CreateSessionTokenOptions {
  sessionId?: string;
  secret: string;
  issuedAtMs?: number;
  ttlMs?: number;
}

interface VerifySessionTokenOptions {
  token: string;
  secret: string;
  nowMs?: number;
}

interface OriginCheckOptions {
  requestOrigin: string;
  configuredOrigin: string;
  nodeEnv: string;
}

interface RateLimitEntry {
  count: number;
  resetAtMs: number;
}

interface MicrosoftIqAuthorizationOptions {
  maxBodyBytes: number;
  rateLimit: {
    key: string;
    limit: number;
    windowMs: number;
  };
  privacyConsentRequired: boolean;
}

export type MicrosoftIqAuthorizationResult =
  | {
      ok: true;
      body: unknown;
      sessionId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      retryAfterSeconds?: number;
    };

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
    );
  } catch {
    return false;
  }
}

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  return (
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  );
}

function getClientKey(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return realIp || forwardedIp || 'unknown-client';
}

export function createSessionToken(options: CreateSessionTokenOptions) {
  if (options.secret.trim().length < 32) {
    throw new Error('Session secret must contain at least 32 characters.');
  }

  const issuedAtMs = options.issuedAtMs ?? Date.now();
  const payload: SessionPayload = {
    version: SESSION_VERSION,
    sessionId: options.sessionId ?? randomUUID(),
    issuedAtMs,
    expiresAtMs: issuedAtMs + (options.ttlMs ?? 60 * 60 * 1000),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, options.secret)}`;
}

export function verifySessionToken(options: VerifySessionTokenOptions): SessionPayload | null {
  if (!options.token || options.secret.trim().length < 32) {
    return null;
  }

  const [encodedPayload, signature, extra] = options.token.split('.');
  if (!encodedPayload || !signature || extra || !safeTextEqual(signature, sign(encodedPayload, options.secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    const nowMs = options.nowMs ?? Date.now();
    if (
      payload.version !== SESSION_VERSION ||
      typeof payload.sessionId !== 'string' ||
      !payload.sessionId ||
      typeof payload.issuedAtMs !== 'number' ||
      typeof payload.expiresAtMs !== 'number' ||
      payload.issuedAtMs > nowMs + 60_000 ||
      payload.expiresAtMs <= nowMs
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function isAllowedRequestOrigin(options: OriginCheckOptions) {
  const requestOrigin = normalizeOrigin(options.requestOrigin);
  const configuredOrigin = normalizeOrigin(options.configuredOrigin);

  if (configuredOrigin) {
    return requestOrigin === configuredOrigin;
  }

  return options.nodeEnv !== 'production' && isLocalDevelopmentOrigin(requestOrigin);
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  consume(key: string, limit: number, windowMs: number, nowMs = Date.now()) {
    const existing = this.entries.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
      const resetAtMs = nowMs + windowMs;
      this.entries.set(key, { count: 1, resetAtMs });
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAtMs };
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetAtMs: existing.resetAtMs };
    }

    existing.count += 1;
    return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAtMs: existing.resetAtMs };
  }
}

export async function readJsonBodyWithLimit(request: Request, maxBytes: number) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new Error('Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Request body exceeds ${maxBytes} bytes.`);
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Request body exceeds ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  }

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

const cloudRateLimiter = new FixedWindowRateLimiter();
const sessionRateLimiter = new FixedWindowRateLimiter();

export function rateLimitSessionCreation(request: Request) {
  const result = sessionRateLimiter.consume(`session:${getClientKey(request)}`, 5, 10 * 60 * 1000);
  return {
    ...result,
    retryAfterSeconds: Math.max(1, Math.ceil((result.resetAtMs - Date.now()) / 1000)),
  };
}

export function verifyConfiguredAccessCode(candidate: string) {
  const configured = process.env.MICROSOFT_IQ_DEMO_ACCESS_CODE?.trim() ?? '';
  return configured.length >= 12 && safeTextEqual(candidate.trim(), configured);
}

export function getMicrosoftIqSessionFromRequest(request: Request) {
  const sessionSecret = process.env.MICROSOFT_IQ_SESSION_SECRET?.trim() ?? '';
  const token = readCookie(request.headers.get('cookie') ?? '', MICROSOFT_IQ_SESSION_COOKIE);
  return verifySessionToken({ token, secret: sessionSecret });
}

export async function authorizeMicrosoftIqRequest(
  request: Request,
  options: MicrosoftIqAuthorizationOptions,
): Promise<MicrosoftIqAuthorizationResult> {
  const origin = request.headers.get('origin') ?? '';
  if (
    !isAllowedRequestOrigin({
      requestOrigin: origin,
      configuredOrigin: process.env.APP_ORIGIN?.trim() ?? '',
      nodeEnv: process.env.NODE_ENV ?? 'development',
    })
  ) {
    return { ok: false, status: 403, error: 'Request origin is not allowed.' };
  }

  if (options.privacyConsentRequired && request.headers.get(MICROSOFT_IQ_CONSENT_HEADER) !== 'granted') {
    return { ok: false, status: 428, error: 'Explicit Microsoft cloud processing consent is required.' };
  }

  const session = getMicrosoftIqSessionFromRequest(request);
  if (!session) {
    return { ok: false, status: 401, error: 'A valid demo session is required.' };
  }

  const limit = cloudRateLimiter.consume(
    `${options.rateLimit.key}:${session.sessionId}`,
    options.rateLimit.limit,
    options.rateLimit.windowMs,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'Too many cloud requests. Wait before trying again.',
      retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAtMs - Date.now()) / 1000)),
    };
  }

  try {
    return {
      ok: true,
      body: await readJsonBodyWithLimit(request, options.maxBodyBytes),
      sessionId: session.sessionId,
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.message.includes('exceeds') ? 413 : 400,
      error: error instanceof Error ? error.message : 'Invalid request body.',
    };
  }
}
