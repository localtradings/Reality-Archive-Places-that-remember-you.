# Reality Archive

Reality Archive is a mobile-first Next.js prototype for turning Iloilo places into a living museum experience.

## AI Runtime

The AI Living Museum is grounded in the archive first:

- place metadata
- visitor memories
- photo captions
- voice transcripts

### Microsoft IQ Integration: Foundry IQ

Reality Archive satisfies the Microsoft IQ requirement with **Foundry IQ**.
Microsoft Foundry / Azure AI Foundry is the primary Microsoft AI platform for this project, and
Reality Archive uses an Azure OpenAI model deployment inside Foundry for runtime generation.
Work IQ and Fabric IQ are not used in this prototype.

For grounded retrieval, the project also supports an Azure AI Search-backed Foundry IQ layer.
That retrieval layer can work in a prepared mode even when live Azure OpenAI generation is not available.

That means the app uses Azure-hosted OpenAI-style values, not public OpenAI, when the Azure
environment variables are configured:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

### Why Foundry IQ

Foundry IQ was selected because Reality Archive grounds the AI Living Museum in archive knowledge
instead of inventing an unmoored story. The generated museum only uses:

- place metadata
- visitor memories
- photo captions
- voice transcripts

Azure AI Search is the intended knowledge and retrieval layer for those archive chunks. When live
search is configured, the app can retrieve indexed place-archive chunks before generation. When it
is not configured, the app still prepares the exact normalized archive document and source chunks
that would be indexed.

### Fallbacks

- Azure / Microsoft Foundry is the primary runtime for the Foundry IQ layer.
- OpenAI is an optional local development fallback only when Azure credentials are not configured.
- If neither provider is configured, the app returns the grounded static museum preview.
- The app must not claim live Azure generation unless the museum response `source` is `azure`.

### Azure for Students Note

Azure for Students can have zero Azure OpenAI model quota. In that case, live Azure OpenAI
generation may require a different subscription or quota-enabled resource. Reality Archive does
not fake live Azure generation. The Foundry IQ retrieval layer can still run in prepared mode, and
the app keeps the OpenAI and static fallbacks.

## GitHub Copilot

GitHub Copilot can help scaffold code, refactors, and documentation, but the archive grounding rules
still apply. The generated museum content must stay tied to the place archive and must not invent
facts that are not present in the input.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

```bash
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-10-21

MICROSOFT_IQ_ENABLED=false
AZURE_AI_SEARCH_ENDPOINT=
AZURE_AI_SEARCH_API_KEY=
AZURE_AI_SEARCH_INDEX_NAME=

# Optional fallback only
OPENAI_API_KEY=

# Public browser key for Geoapify only
NEXT_PUBLIC_GEOAPIFY_API_KEY=
```

Only the `NEXT_PUBLIC_` Geoapify key is exposed to the browser. All AI keys stay server-side.

## Where to Find Azure Values

- `AZURE_OPENAI_ENDPOINT`: Foundry / Azure OpenAI resource -> `Keys and endpoint` -> `Endpoint`.
  It usually looks like `https://YOUR-RESOURCE-NAME.openai.azure.com/`.
- `AZURE_OPENAI_API_KEY`: same `Keys and endpoint` page -> `KEY 1` or `KEY 2`.
- `AZURE_OPENAI_DEPLOYMENT`: Foundry -> `Models + endpoints` / `Deployments` -> the deployment name
  you created. This is the deployment name, not necessarily the base model name.
- `AZURE_OPENAI_API_VERSION`: keep the dated API version used by the current code.

## Troubleshooting

- If provider is `fallback`, the Azure environment variables are missing or invalid.
- If provider is `openai`, the Azure environment variables are missing and `OPENAI_API_KEY` is being used.
- If provider is `azure`, the app is using the Microsoft / Azure Foundry path for Foundry IQ.
- If `microsoftIqMode` is `prepared`, Azure AI Search is disabled, incomplete, or returned no usable chunks.
- If `microsoftIqMode` is `live`, the app retrieved grounding chunks from Azure AI Search before generation.

## Development

```bash
npm install
npm run build
npm run dev
```

## Notes

- The museum route always stays grounded in the selected place archive.
- The Microsoft IQ layer is Foundry IQ, with Azure AI Search as the retrieval surface.
- The UI does not expose any AI keys to the browser.
