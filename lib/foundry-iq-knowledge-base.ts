const FOUNDRY_IQ_API_VERSION = '2026-05-01-preview';

interface FoundryIqRetrieveOptions {
  endpoint: string;
  knowledgeBaseName: string;
  apiKey: string;
  query: string;
}

interface FoundryIqReference {
  id?: unknown;
  type?: unknown;
  docKey?: unknown;
  sourceData?: unknown;
}

interface FoundryIqResponseMessage {
  role?: unknown;
  content?: unknown;
}

export interface FoundryIqKnowledgeChunk {
  id: string;
  title: string;
  content: string;
  citation: string;
  sourceLabel: string;
}

export interface FoundryIqRetrieveResult {
  live: boolean;
  chunks: FoundryIqKnowledgeChunk[];
  citations: string[];
  activityCount: number;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanEndpoint(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function responseTexts(messages: FoundryIqResponseMessage[]) {
  return messages
    .filter((message) => message.role === 'assistant' && Array.isArray(message.content))
    .flatMap((message) => message.content as unknown[])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .filter((item) => item.type === 'text')
    .map((item) => normalizeText(item.text))
    .filter(Boolean);
}

function parseExtractedData(messages: FoundryIqResponseMessage[]) {
  return responseTexts(messages).flatMap((text) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed.map(asRecord).filter((item): item is Record<string, unknown> => item !== null) : [];
    } catch {
      return [];
    }
  });
}

function buildReferenceCitation(reference: FoundryIqReference, id: string, sourceData: Record<string, unknown> | null) {
  const explicitCitation =
    normalizeText(sourceData?.citation) || normalizeText(sourceData?.url) || normalizeText(sourceData?.source);
  if (explicitCitation) {
    return explicitCitation;
  }

  const type = normalizeText(reference.type) || 'reference';
  const documentKey = normalizeText(reference.docKey) || id;
  return `foundry-iq://${encodeURIComponent(type)}/${encodeURIComponent(documentKey)}`;
}

export function buildFoundryIqRetrieveRequest(options: FoundryIqRetrieveOptions) {
  const endpoint = cleanEndpoint(options.endpoint);
  const knowledgeBaseName = options.knowledgeBaseName.trim();
  const query = options.query.trim();

  if (!endpoint || !knowledgeBaseName || !options.apiKey.trim() || !query) {
    throw new Error('Foundry IQ knowledge-base endpoint, name, API key, and query are required.');
  }

  return {
    url: `${endpoint}/knowledgebases/${encodeURIComponent(knowledgeBaseName)}/retrieve?api-version=${FOUNDRY_IQ_API_VERSION}`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': options.apiKey.trim(),
      },
      body: {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: query }],
          },
        ],
        includeActivity: true,
        outputMode: 'extractedData',
        retrievalReasoningEffort: { kind: 'low' },
        maxOutputDocuments: 20,
        maxOutputSize: 6_000,
      },
    },
  };
}

export function parseFoundryIqRetrieveResponse(value: unknown): FoundryIqRetrieveResult {
  const record = asRecord(value);
  if (!record) {
    return { live: false, chunks: [], citations: [], activityCount: 0 };
  }

  const messages = Array.isArray(record.response) ? (record.response as FoundryIqResponseMessage[]) : [];
  const references = Array.isArray(record.references) ? (record.references as FoundryIqReference[]) : [];
  const referencesById = new Map(
    references
      .map((reference) => [normalizeText(reference.id), reference] as const)
      .filter(([id]) => id.length > 0),
  );
  const extractedData = parseExtractedData(messages);
  const extractedChunks = extractedData.flatMap((item, index) => {
    const referenceId = normalizeText(item.ref_id);
    const reference = referencesById.get(referenceId);
    if (!reference) {
      return [];
    }

    const sourceData = asRecord(reference.sourceData);
    const id = referenceId || `reference-${index + 1}`;
    const title =
      normalizeText(item.title) ||
      normalizeText(sourceData?.title) ||
      normalizeText(sourceData?.name) ||
      normalizeText(reference.type) ||
      `Knowledge-base reference ${index + 1}`;
    const content =
      normalizeText(item.content) ||
      normalizeText(sourceData?.content) ||
      normalizeText(sourceData?.text) ||
      normalizeText(sourceData?.chunk);
    const citation = content ? buildReferenceCitation(reference, id, sourceData) : '';

    if (!content || !citation) {
      return [];
    }

    return [
      {
        id,
        title,
        content,
        citation,
        sourceLabel: 'Foundry IQ knowledge base',
      } satisfies FoundryIqKnowledgeChunk,
    ];
  });
  const legacyChunks =
    extractedChunks.length > 0
      ? []
      : references.flatMap((reference, index) => {
          const sourceData = asRecord(reference.sourceData);
          const id = normalizeText(reference.id) || `reference-${index + 1}`;
          const content =
            normalizeText(sourceData?.content) || normalizeText(sourceData?.text) || normalizeText(sourceData?.chunk);
          if (!content) {
            return [];
          }

          return [
            {
              id,
              title:
                normalizeText(sourceData?.title) ||
                normalizeText(sourceData?.name) ||
                normalizeText(reference.type) ||
                `Knowledge-base reference ${index + 1}`,
              content,
              citation: buildReferenceCitation(reference, id, sourceData),
              sourceLabel: 'Foundry IQ knowledge base',
            } satisfies FoundryIqKnowledgeChunk,
          ];
        });
  const chunks = [...extractedChunks, ...legacyChunks];
  const citations = uniqueStrings(chunks.map((chunk) => chunk.citation));

  return {
    live: chunks.length > 0 && citations.length > 0,
    chunks,
    citations,
    activityCount: Array.isArray(record.activity) ? record.activity.length : 0,
  };
}

export async function retrieveFoundryIqKnowledgeBase(options: FoundryIqRetrieveOptions): Promise<FoundryIqRetrieveResult> {
  const request = buildFoundryIqRetrieveRequest(options);
  const response = await fetch(request.url, {
    method: request.init.method,
    headers: request.init.headers,
    body: JSON.stringify(request.init.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`Foundry IQ knowledge-base retrieval failed with ${response.status}: ${detail}`);
  }

  return parseFoundryIqRetrieveResponse(await response.json());
}
