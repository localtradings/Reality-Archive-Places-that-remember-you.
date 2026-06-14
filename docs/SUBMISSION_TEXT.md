# Project Description

## Reality Archive: Places That Remember You

Reality Archive is a local-first living museum for places connected to personal memory. Instead of recommending the next destination, it helps someone preserve places that already matter: an old cafe, a family street, a landmark, or a quiet location tied to a specific moment.

Visitors can discover nearby places through Geoapify and OpenStreetMap, search clearly labeled demo archives, or add a real place manually without any external API. They can then preserve text, photo, or voice memories in browser storage. The Museum includes only places the visitor has personally added or remembered.

Local summaries work without cloud services. Optional cloud curation is explicit and consent-gated. After a private demo session is authenticated, the server uploads normalized archive documents to Azure AI Search, retrieves grounded passages through a managed Foundry IQ knowledge base, and asks a Microsoft Foundry agent or model to write a story using only those passages. The interface labels output live only when knowledge-base references are returned.

GitHub Copilot helped scaffold the Next.js structure, reusable components, route organization, maps, place discovery, local memory capture, and the first Museum prototype. Codex supported later debugging, UI hardening, tests, privacy controls, secure route handling, and submission preparation.

### Technologies

- Next.js 16 and React 19
- TypeScript
- Leaflet and React Leaflet
- OpenStreetMap
- Geoapify
- Azure AI Search
- Foundry IQ managed knowledge base
- Microsoft Foundry agent/model
- GitHub Copilot

### Reliability And Safety

- Local-first fallback with no cloud dependency.
- Explicit privacy disclosure and consent.
- Signed demo sessions and same-origin checks.
- Request limits, rate limits, and security headers.
- No browser-visible Azure secrets.
- No fake place exhibits in an empty Museum.
- No live Foundry IQ claim without grounded knowledge-base references.

