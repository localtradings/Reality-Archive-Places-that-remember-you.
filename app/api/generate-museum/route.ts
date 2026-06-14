import { NextResponse } from 'next/server';
import {
  normalizeMuseumArchiveMemoryInput,
  normalizeMuseumGenerationPlaceInput,
  normalizeMuseumPreview,
  type MicrosoftIqLayer,
  type MicrosoftIqMode,
  type MuseumGenerationProvider,
  type MuseumGenerationPlaceInput,
  type MuseumGenerationRequestPayload,
  type MuseumGenerationResponseBody,
  type MuseumArchiveMemoryInput,
} from '@/lib/museum-generation';
import { buildMicrosoftIqGroundingContext } from '@/lib/microsoft-iq';
import type { MuseumPreview } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildFallbackMuseum(
  place: MuseumGenerationPlaceInput,
  memories: MuseumArchiveMemoryInput[],
  fallbackMuseum: MuseumPreview | null,
): MuseumPreview {
  if (fallbackMuseum) {
    return fallbackMuseum;
  }

  const memoryCountText = memories.length === 0 ? 'The archive is still growing.' : `The archive includes ${memories.length} memory${memories.length === 1 ? '' : 's'}.`;
  const moodLine = place.moods.slice(0, 2).join(' · ') || 'Calm';

  return {
    livingExhibit: `A grounded museum preview for ${place.name}, shaped from the place metadata and the memories already saved in this archive.`,
    placeMood: `${place.category} at ${place.address}. Mood cues: ${moodLine}.`,
    memoryWallSummary: memoryCountText,
    voiceTourScript: [
      `Welcome to ${place.name}, a living archive built from the place details already available here.`,
      'This preview keeps the story close to the archive and avoids inventing facts that are not already present.',
      memories.length === 0 ? 'The archive is still growing, so this museum is intentionally quiet and open-ended.' : 'The memories in this archive shape the exhibit, voice guide, and visitor notes.',
    ],
    visitorTips: [
      'Use the archive to add more memories and deepen the museum preview.',
      'Treat this as a grounded fallback while the live generation layer is unavailable.',
      'Revisit after adding memories to see the exhibit become more specific.',
    ],
    miniQuest: {
      title: 'Archive starter',
      prompt: 'Add one new memory that helps this place feel more alive.',
      reward: 'A museum page that grows with the archive.',
    },
    sourcesUsed: ['Place metadata', memories.length > 0 ? 'Saved archive memories' : 'Empty archive placeholder'],
  };
}

function buildResponse(
  museum: MuseumPreview,
  generated: boolean,
  source: MuseumGenerationResponseBody['source'],
  provider: MuseumGenerationProvider,
  microsoftIqLayer: MicrosoftIqLayer,
  microsoftIqMode: MicrosoftIqMode,
  groundingSources: string[],
  citations: string[],
  reason?: string,
): MuseumGenerationResponseBody {
  return {
    generated,
    museum,
    source,
    provider,
    microsoftIqLayer,
    microsoftIqMode,
    groundingSources,
    citations,
    ...(reason ? { reason } : {}),
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      buildResponse(
        buildFallbackMuseum(
          { id: 'unknown', name: 'Unknown place', address: 'Unknown address', category: 'Archive', description: 'No archive data was provided.', moods: ['Calm'] },
          [],
          null,
        ),
        false,
        'fallback',
        'fallback',
        'foundry-iq',
        'prepared',
        [],
        [],
        'Invalid JSON body.',
      ),
      { status: 200 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      buildResponse(
        buildFallbackMuseum(
          { id: 'unknown', name: 'Unknown place', address: 'Unknown address', category: 'Archive', description: 'No archive data was provided.', moods: ['Calm'] },
          [],
          null,
        ),
        false,
        'fallback',
        'fallback',
        'foundry-iq',
        'prepared',
        [],
        [],
        'Invalid request payload.',
      ),
      { status: 200 },
    );
  }

  const rawPlace = body.place;
  const place = normalizeMuseumGenerationPlaceInput(body.place);
  const memories = Array.isArray(body.memories)
    ? body.memories.map(normalizeMuseumArchiveMemoryInput).filter((memory): memory is MuseumArchiveMemoryInput => memory !== null)
    : [];
  const fallbackMuseum = normalizeMuseumPreview(body.fallbackMuseum);

  if (!place) {
    const fallback = buildFallbackMuseum(
      {
        id: isRecord(rawPlace) ? normalizeText(rawPlace.id) || 'unknown' : 'unknown',
        name: isRecord(rawPlace) ? normalizeText(rawPlace.name) || 'Unknown place' : 'Unknown place',
        address: isRecord(rawPlace) ? normalizeText(rawPlace.address) || 'Unknown address' : 'Unknown address',
        category: isRecord(rawPlace) ? normalizeText(rawPlace.category) || 'Archive' : 'Archive',
        description: isRecord(rawPlace) ? normalizeText(rawPlace.description) || 'No archive data was provided.' : 'No archive data was provided.',
        moods: ['Calm'],
      },
      memories,
      fallbackMuseum,
    );

    return NextResponse.json(buildResponse(fallback, false, 'fallback', 'fallback', 'foundry-iq', 'prepared', [], [], 'Missing place metadata.'), {
      status: 200,
    });
  }

  const requestPayload: MuseumGenerationRequestPayload = {
    place,
    memories,
    fallbackMuseum: fallbackMuseum ?? buildFallbackMuseum(place, memories, null),
  };
  const microsoftIqGrounding = await buildMicrosoftIqGroundingContext(requestPayload);

  return NextResponse.json(
    buildResponse(
      requestPayload.fallbackMuseum,
      false,
      microsoftIqGrounding.layer,
      microsoftIqGrounding.layer,
      microsoftIqGrounding.layer,
      microsoftIqGrounding.mode,
      microsoftIqGrounding.groundingSources,
      microsoftIqGrounding.citations,
      microsoftIqGrounding.mode === 'live'
        ? 'Using Foundry IQ live grounding from Azure AI Search with the archive museum preview.'
        : 'Using the prepared Foundry IQ archive context with the static museum preview.',
    ),
    { status: 200 },
  );
}
