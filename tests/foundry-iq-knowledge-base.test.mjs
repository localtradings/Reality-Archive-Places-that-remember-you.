import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFoundryIqRetrieveRequest,
  parseFoundryIqRetrieveResponse,
} from '../lib/foundry-iq-knowledge-base.ts';

test('builds the official Foundry IQ knowledge-base retrieve request', () => {
  const request = buildFoundryIqRetrieveRequest({
    endpoint: 'https://reality-archive.search.windows.net/',
    knowledgeBaseName: 'reality-archive-kb',
    knowledgeSourceName: 'reality-archive-ks',
    apiKey: 'server-secret',
    query: 'Iloilo River Esplanade calm memory',
  });

  assert.equal(
    request.url,
    'https://reality-archive.search.windows.net/knowledgebases/reality-archive-kb/retrieve?api-version=2026-05-01-preview',
  );
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers['api-key'], 'server-secret');
  assert.deepEqual(request.init.body.intents, [
    {
      type: 'semantic',
      search: 'Iloilo River Esplanade calm memory',
    },
  ]);
  assert.equal(request.init.body.includeActivity, true);
  assert.equal(Object.hasOwn(request.init.body, 'outputMode'), false);
  assert.deepEqual(request.init.body.retrievalReasoningEffort, { kind: 'minimal' });
  assert.deepEqual(request.init.body.knowledgeSourceParams, [
    {
      knowledgeSourceName: 'reality-archive-ks',
      kind: 'searchIndex',
      includeReferences: true,
      includeReferenceSourceData: true,
    },
  ]);
  assert.equal(request.init.body.maxOutputDocuments, 20);
  assert.equal(request.init.body.maxOutputSize, 6_000);
});

test('parses documented extractedData chunks and matches them to references', () => {
  const parsed = parseFoundryIqRetrieveResponse({
    response: [
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                ref_id: 'ref-1',
                title: 'Visitor memory: Evening walk',
                content: 'The saved memory describes a calm walk beside the river.',
              },
            ]),
          },
        ],
      },
    ],
    references: [
      {
        id: 'ref-1',
        type: 'AzureSearchDoc',
        docKey: 'ra-iloilo-river-memory-1',
        sourceData: null,
      },
    ],
  });

  assert.equal(parsed.live, true);
  assert.equal(parsed.chunks.length, 1);
  assert.equal(parsed.chunks[0].content, 'The saved memory describes a calm walk beside the river.');
  assert.equal(parsed.chunks[0].citation, 'foundry-iq://AzureSearchDoc/ra-iloilo-river-memory-1');
  assert.deepEqual(parsed.citations, ['foundry-iq://AzureSearchDoc/ra-iloilo-river-memory-1']);
});

test('does not mark an ungrounded assistant response as live', () => {
  const parsed = parseFoundryIqRetrieveResponse({
    response: [
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'An answer without any knowledge-base reference.' }],
      },
    ],
    references: [],
  });

  assert.equal(parsed.live, false);
  assert.deepEqual(parsed.chunks, []);
  assert.deepEqual(parsed.citations, []);
});
