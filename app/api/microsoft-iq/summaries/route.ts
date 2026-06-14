import { NextResponse } from 'next/server';
import { buildLocalCollectionSummary } from '@/lib/museum-collection';
import {
  normalizeMuseumArchiveMemoryInput,
  normalizeMuseumGenerationPlaceInput,
  normalizeMuseumPreview,
  type MuseumArchiveMemoryInput,
  type MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';
import { generateFoundryIqCollectionSummaries, getMicrosoftIqConfigStatus } from '@/lib/microsoft-iq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePayload(value: unknown): MuseumGenerationRequestPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const place = normalizeMuseumGenerationPlaceInput(value.place);
  const memories = Array.isArray(value.memories)
    ? value.memories.map(normalizeMuseumArchiveMemoryInput).filter((memory): memory is MuseumArchiveMemoryInput => memory !== null)
    : [];
  const fallbackMuseum = normalizeMuseumPreview(value.fallbackMuseum);

  if (!place || !fallbackMuseum) {
    return null;
  }

  return {
    place,
    memories,
    fallbackMuseum,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body) || !Array.isArray(body.places)) {
    return NextResponse.json({ error: 'Expected a places array.' }, { status: 400 });
  }

  const payloads = body.places.map(normalizePayload).filter((payload): payload is MuseumGenerationRequestPayload => payload !== null);
  if (payloads.length === 0) {
    return NextResponse.json(buildLocalCollectionSummary([]));
  }

  const status = getMicrosoftIqConfigStatus();
  if (!status.enabled) {
    return NextResponse.json({
      ...buildLocalCollectionSummary(payloads),
      mode: 'prepared',
      provider: 'foundry-iq',
      reason: 'Microsoft IQ is disabled, so local summaries remain visible.',
    });
  }

  try {
    const summaries = await generateFoundryIqCollectionSummaries(payloads);
    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Foundry IQ summary route failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Foundry IQ summary generation failed.',
      },
      { status: 500 },
    );
  }
}
