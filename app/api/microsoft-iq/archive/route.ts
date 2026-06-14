import { NextResponse } from 'next/server';
import {
  normalizeMuseumArchiveMemoryInput,
  normalizeMuseumGenerationPlaceInput,
  normalizeMuseumPreview,
  type MuseumArchiveMemoryInput,
  type MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';
import { buildMicrosoftIqArchiveDocument, buildMicrosoftIqGroundingContext, getMicrosoftIqConfigStatus } from '@/lib/microsoft-iq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

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
