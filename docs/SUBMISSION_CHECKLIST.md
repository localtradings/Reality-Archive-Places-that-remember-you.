# Submission Checklist

## Repository Verification

- [x] Public source repository exists.
- [x] README explains the problem, features, technologies, privacy, architecture, and setup.
- [x] Architecture diagram is included.
- [x] License and third-party notices are included.
- [x] Demo data is labeled.
- [x] Unverified binary reference artwork was removed.
- [x] `.env.local`, `.DS_Store`, and TypeScript build-info files are not submitted.
- [x] Production dependency audit reports zero known vulnerabilities.
- [x] Production build succeeds.
- [x] Azure-backed routes require consent, signed sessions, origin checks, limits, and rate controls.

## Foundry IQ Verification

- [ ] Confirm the existing Azure AI Search index contains the Reality Archive schema.
- [ ] Confirm `AZURE_AI_SEARCH_KNOWLEDGE_BASE_NAME` identifies a real managed knowledge base connected to that index.
- [ ] Set the exact deployed `APP_ORIGIN`.
- [ ] Set private demo access and session secrets in the deployment environment.
- [ ] Run one consented request and confirm the response contains knowledge-base references.
- [ ] Confirm the UI displays **Live Foundry IQ story**, not local or prepared mode.
- [ ] Confirm citations correspond to the saved archive.

Do not mark these items complete based only on local mocks or configuration presence.

## Entrant And Legal Confirmation

- [ ] Registration form submitted.
- [ ] Hackathon profile activated from the registration email.
- [ ] Creative Apps challenge selected.
- [ ] Entrant meets age, region, employment, and contest eligibility rules.
- [ ] Team member Microsoft Learn usernames are complete, if applicable.
- [ ] Project has not previously won another contest.
- [ ] GitHub 2FA is enabled and recovery codes are stored securely.
- [ ] Any required Microsoft CLA is accepted.
- [ ] The entrant accepts the submission license and contest-use provisions.

## Demo Video

- [ ] A genuine user-created place and memory are recorded.
- [ ] Real Foundry IQ retrieval is successfully demonstrated.
- [ ] Video is no longer than five minutes.
- [ ] Video shows no unlicensed music, photos, footage, private data, account pages, billing pages, or unrelated third-party trademarks.
- [ ] Video is uploaded to YouTube or Vimeo.
- [ ] Video URL is added to the README and contest form.

## Contest Form

- [ ] Project description from `docs/SUBMISSION_TEXT.md` is entered.
- [ ] Public GitHub URL is entered.
- [ ] Demo video URL is entered.
- [ ] `docs/architecture.svg` is uploaded or linked.
- [ ] Team details are entered.
- [ ] Submission is completed before June 14, 2026 at 11:59 PM Pacific Time.

