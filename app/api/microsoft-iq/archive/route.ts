import { NextResponse } from 'next/server';
import {
  normalizeMuseumArchiveMemoryInput,
  normalizeMuseumGenerationPlaceInput,
  normalizeMuseumPreview,
  type MuseumArchiveMemoryInput,
  type MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';
import { buildMicrosoftIqArchiveDocument, buildMicrosoftIqGroundingContext, getMicrosoftIqConfigStatus } from '@/lib/microsoft-iq';
import { authorizeMicrosoftIqRequest } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request) {
  const authorization = await authorizeMicrosoftIqRequest(request, {
    maxBodyBytes: 256 * 1024,
    rateLimit: { key: 'archive', limit: 10, windowMs: 60_000 },
    privacyConsentRequired: true,
  });
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      {
        status: authorization.status,
        ...(authorization.retryAfterSeconds ? { headers: { 'Retry-After': String(authorization.retryAfterSeconds) } } : {}),
      },
    );
  }

  const body = authorization.body;
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const place = normalizeMuseumGenerationPlaceInput(body.place);
  const memories = Array.isArray(body.memories)
    ? body.memories.map(normalizeMuseumArchiveMemoryInput).filter((memory): memory is MuseumArchiveMemoryInput => memory !== null)
    : [];
  const fallbackMuseum = normalizeMuseumPreview(body.fallbackMuseum);

  if (!place || !fallbackMuseum) {
    return NextResponse.json({ error: 'Place metadata and fallback museum are required.' }, { status: 400 });
  }

  const payload: MuseumGenerationRequestPayload = {
    place,
    memories,
    fallbackMuseum,
  };
  const archive = buildMicrosoftIqArchiveDocument(payload);
  const grounding = await buildMicrosoftIqGroundingContext(payload);
  const status = getMicrosoftIqConfigStatus();

  return NextResponse.json({
    microsoftIqLayer: 'foundry-iq',
    microsoftIqMode: grounding.mode,
    enabled: status.enabled,
    configured: status.configured,
    document: archive.document,
    sourceChunks: archive.sourceChunks,
    groundingSources: grounding.groundingSources,
    citations: grounding.citations,
  });
}
