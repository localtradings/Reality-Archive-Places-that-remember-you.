# Reality Archive


## AI Runtime

The AI Living Museum is grounded in the archive first:

- place metadata
- visitor memories
- photo captions
- voice transcripts

### Microsoft IQ Integration: Foundry IQ

Reality Archive satisfies the Microsoft IQ requirement with **Foundry IQ**.
Microsoft Foundry / Azure AI Foundry is the primary Microsoft AI platform for this project, and
Reality Archive uses a Foundry IQ retrieval layer built on Azure AI Search for archive grounding.
Work IQ and Fabric IQ are not used in this prototype.

The app does not require separate model runtime keys. The museum page uses the archive's grounded
static preview, then attaches Microsoft IQ grounding sources from Azure AI Search when the Foundry
IQ layer is configured.

### Why Foundry IQ

Foundry IQ was selected because Reality Archive grounds the AI Living Museum in archive knowledge
instead of inventing an unmoored story. The generated museum only uses:

- place metadata
- visitor memories
- photo captions
- voice transcripts

Azure AI Search is the intended knowledge and retrieval layer for those archive chunks. When live
search is configured, the app can retrieve indexed place-archive chunks before the museum preview is
returned. When it is not configured, the app still prepares the exact normalized archive document
and source chunks that would be indexed.

### Fallbacks

- Foundry IQ through Azure AI Search is the only Microsoft IQ integration path.
- If Azure AI Search is not configured, the app returns the grounded static museum preview with prepared archive context.
- The app must not claim live Microsoft IQ grounding unless the museum response `microsoftIqMode` is `live`.

### Azure for Students Note

Azure for Students can have limited service quota. Reality Archive only needs the Azure AI
Search-backed Foundry IQ path. The Foundry IQ retrieval layer can still run in prepared mode when
Azure AI Search is not configured, and the app keeps the grounded static museum preview available.

## GitHub Copilot

GitHub Copilot, using MAI-Code-1-Flash, was used during the early and mid development phases of Reality Archive. It helped scaffold the initial Next.js App Router structure, create the first reusable UI components, set up mock place and memory data, and build the first clickable prototype flow. This included the Home page, Explore page, Place Archive page, Add Memory page, and Museum page.

Copilot was also used to assist with the first version of the app’s core features. This included the mobile-first layout, place cards, memory cards, mood badges, early mock archive data, and the early AI Living Museum preview. It helped speed up development by suggesting TypeScript structure, component patterns, reusable UI logic, and route organization.

GitHub Copilot, using MAI-Code-1-Flash, was used during the early and mid development phases of Reality Archive. It helped scaffold the initial Next.js App Router structure, create the first reusable UI components, set up mock place and memory data, and build the first clickable prototype flow. This included the Home page, Explore page, Place Archive page, Add Memory page, and Museum page.

Copilot also helped implement the live place discovery and memory capture features. It assisted with integrating Leaflet, OpenStreetMap, browser geolocation, and Geoapify nearby place discovery. It also helped build the local memory system, including text memories, photo picker and preview support, a voice transcript stub, and localStorage saving.

For the AI Living Museum feature, Copilot helped create and refine the first version of the generation flow. This included work on `app/api/generate-museum/route.ts`, `lib/museum-generation.ts`, and `components/MuseumExperience.tsx`. These files helped define the museum generation API route, shared request and response logic, session caching, and the client-side museum experience.

Later in the project, Codex GPT-5.5 was used for debugging. Codex helped improve the UI/UX redesign, including the dark archive/storybook visual style, desktop responsive layouts, torn-paper design system, empty-state screens, and final interface polish. The UI redesign was done using Codex. Overall, GitHub Copilot contributed heavily to the core app structure, prototype flow, map discovery, memory capture, and first AI Living Museum implementation.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

```bash
MICROSOFT_IQ_ENABLED=true
AZURE_AI_SEARCH_ENDPOINT=
AZURE_AI_SEARCH_API_KEY=
AZURE_AI_SEARCH_INDEX_NAME=
AZURE_AI_PROJECT_ENDPOINT=
AZURE_AI_AGENT_ID=
AZURE_AI_AGENT_API_KEY=

# Public browser key for Geoapify only
NEXT_PUBLIC_GEOAPIFY_API_KEY=
```

Only the `NEXT_PUBLIC_` Geoapify key is exposed to the browser. The Azure AI Search key stays server-side.

Do not commit real `.env.local` values. Use `.env.example` only as a placeholder template.

## Where to Find Microsoft IQ Values

- `MICROSOFT_IQ_ENABLED`: set to `true` only when Azure AI Search is ready.
- `AZURE_AI_SEARCH_ENDPOINT`: Azure AI Search resource endpoint.
- `AZURE_AI_SEARCH_API_KEY`: Azure AI Search admin/query key used server-side only.
- `AZURE_AI_SEARCH_INDEX_NAME`: the index name for Reality Archive source chunks.
- `AZURE_AI_PROJECT_ENDPOINT`: Azure AI Foundry project endpoint used by the existing Agent.
- `AZURE_AI_AGENT_ID`: existing Foundry Agent ID that writes museum summaries.
- `AZURE_AI_AGENT_API_KEY`: server-side token/key used to call the configured Foundry Agent.

## Troubleshooting

- If provider is `fallback`, the app is showing the static archive preview.
- If provider is `foundry-iq`, the app is using the Microsoft IQ / Foundry IQ path.
- If `microsoftIqMode` is `prepared`, Azure AI Search is disabled, incomplete, or returned no usable chunks.
- If `microsoftIqMode` is `live`, the app retrieved grounding chunks from Azure AI Search before returning the museum preview.

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
