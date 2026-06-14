# Privacy

Reality Archive is designed as a local-first prototype.

## Data Stored In The Browser

- Manually added, searched, and nearby place records.
- Memory titles, moods, and text.
- Selected photo files encoded for local display.
- Voice recordings in IndexedDB.
- Generated local summaries and temporary place data.

This data remains in the current browser profile unless the user explicitly requests Microsoft cloud curation.

## External Requests

### Geoapify

When nearby discovery is used, browser coordinates are sent to Geoapify. When remembered-place search or optional address resolution is used, the search text is sent to Geoapify. Manual place creation still works when Geoapify is unavailable.

### OpenStreetMap

Displaying the map requests tiles from OpenStreetMap servers. Normal network metadata such as IP address and browser headers may be visible to the tile provider.

### Microsoft Azure And Foundry IQ

No archive data is sent to Azure automatically.

Before an optional cloud request, the interface discloses that these fields will be sent:

- Place name, address, category, description, moods, and coordinates when present.
- Memory titles, text, moods, and timestamps.
- Photo captions.
- Voice transcripts.

The original photo file and voice recording are not included in the Azure payload.

Cloud processing requires explicit consent and a signed demo session. The normalized archive may be uploaded to the configured Azure AI Search index, retrieved through the configured Foundry IQ knowledge base, and passed to the configured Microsoft Foundry agent or model.

## Retention And Deletion

Browser data can be removed by clearing site data for the application origin. Azure retention depends on the configured Azure AI Search resource, knowledge base, logging, and model settings. The demo operator must review and clear test data manually using the Azure controls available to the project owner.

No destructive remote cleanup is automated by this repository.

## Sensitive Information

Do not enter passwords, credentials, financial information, private medical information, customer data, or confidential employer information. Use only content that you are authorized to submit publicly and process through the configured services.

