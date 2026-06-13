import { NextResponse } from 'next/server';
import {
  MICROSOFT_IQ_SESSION_COOKIE,
  createSessionToken,
  isAllowedRequestOrigin,
  rateLimitSessionCreation,
  readJsonBodyWithLimit,
  verifyConfiguredAccessCode,
} from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request) {
  const originAllowed = isAllowedRequestOrigin({
    requestOrigin: request.headers.get('origin') ?? '',
    configuredOrigin: process.env.APP_ORIGIN?.trim() ?? '',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  });
  if (!originAllowed) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  const rateLimit = rateLimitSessionCreation(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many access-code attempts. Wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 4_096);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body.' },
      { status: error instanceof Error && error.message.includes('exceeds') ? 413 : 400 },
    );
  }

  const accessCode = isRecord(body) && typeof body.accessCode === 'string' ? body.accessCode : '';
  if (!verifyConfiguredAccessCode(accessCode)) {
    return NextResponse.json({ error: 'Invalid demo access code.' }, { status: 401 });
  }

  const sessionSecret = process.env.MICROSOFT_IQ_SESSION_SECRET?.trim() ?? '';
  if (sessionSecret.length < 32) {
    return NextResponse.json({ error: 'Demo session security is not configured.' }, { status: 503 });
  }

  const response = NextResponse.json({ authenticated: true, expiresInSeconds: 3_600 });
  response.cookies.set({
    name: MICROSOFT_IQ_SESSION_COOKIE,
    value: createSessionToken({ secret: sessionSecret }),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 3_600,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

