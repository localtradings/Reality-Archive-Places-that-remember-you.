import { NextResponse } from 'next/server';
import {
  normalizeMuseumArchiveMemoryInput,
  normalizeMuseumGenerationPlaceInput,
  normalizeMuseumPreview,
  type MuseumArchiveMemoryInput,
  type MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';
import {
  buildMicrosoftIqArchiveDocument,
  buildMicrosoftIqGroundingContext,
  buildMicrosoftIqIndexDocuments,
  ensureMicrosoftIqSearchIndex,
  getMicrosoftIqConfigStatus,
  uploadMicrosoftIqArchiveDocuments,
} from '@/lib/microsoft-iq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

  const config = getMicrosoftIqConfigStatus();
  const archive = buildMicrosoftIqArchiveDocument(payload);
  const indexPayload = buildMicrosoftIqIndexDocuments(payload);
  const indexName = normalizeText(process.env.AZURE_AI_SEARCH_INDEX_NAME);

  if (!config.enabled || !config.configured || !indexName) {
    return NextResponse.json({
      microsoftIqLayer: 'foundry-iq',
      microsoftIqMode: 'prepared',
      enabled: config.enabled,
      configured: config.configured,
      indexCreated: false,
      documentsUploaded: 0,
      archiveDocument: archive.document,
      sourceChunks: archive.sourceChunks,
      groundingSources: archive.sourceChunks.map((chunk) => chunk.sourceLabel),
      citations: archive.sourceChunks.map((chunk) => chunk.citation),
      reason: 'Microsoft IQ search is not fully configured.',
    });
  }

  try {
    const indexResult = await ensureMicrosoftIqSearchIndex(indexName);
    const uploadResult = await uploadMicrosoftIqArchiveDocuments(indexName, indexPayload.documents);
    const grounding = await buildMicrosoftIqGroundingContext(payload);

    return NextResponse.json({
      microsoftIqLayer: 'foundry-iq',
      microsoftIqMode: grounding.mode,
      enabled: config.enabled,
      configured: config.configured,
      indexCreated: indexResult.created,
      documentsUploaded: uploadResult.uploaded,
      archiveDocument: archive.document,
      sourceChunks: archive.sourceChunks,
      groundingSources: grounding.groundingSources,
      citations: grounding.citations,
      reason: grounding.mode === 'live' ? undefined : 'Prepared archive uploaded, but live retrieval returned no usable chunks yet.',
    });
  } catch (error) {
    console.error('Microsoft IQ indexing failed:', error);
    return NextResponse.json(
      {
        microsoftIqLayer: 'foundry-iq',
        microsoftIqMode: 'prepared',
        enabled: config.enabled,
        configured: config.configured,
        indexCreated: false,
        documentsUploaded: 0,
        archiveDocument: archive.document,
        sourceChunks: archive.sourceChunks,
        groundingSources: archive.sourceChunks.map((chunk) => chunk.sourceLabel),
        citations: archive.sourceChunks.map((chunk) => chunk.citation),
        reason: 'Azure AI Search indexing failed, so only the prepared archive payload is available.',
      },
      { status: 200 },
    );
  }
}
