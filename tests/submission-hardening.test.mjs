import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('cloud routes require authorization, consent, and bounded request bodies', () => {
  for (const route of [
    'app/api/microsoft-iq/index/route.ts',
    'app/api/microsoft-iq/summaries/route.ts',
    'app/api/microsoft-iq/archive/route.ts',
  ]) {
    const source = read(route);
    assert.match(source, /authorizeMicrosoftIqRequest/);
    assert.match(source, /privacyConsentRequired:\s*true/);
    assert.match(source, /maxBodyBytes:/);
  }

  const sessionRoute = read('app/api/microsoft-iq/session/route.ts');
  assert.match(sessionRoute, /httpOnly:\s*true/);
  assert.match(sessionRoute, /sameSite:\s*'strict'/);
});

test('Foundry IQ live retrieval uses a managed knowledge base, not direct index search', () => {
  const source = read('lib/microsoft-iq.ts');

  assert.match(source, /AZURE_AI_SEARCH_KNOWLEDGE_BASE_NAME/);
  assert.match(source, /retrieveFoundryIqKnowledgeBase/);
  assert.doesNotMatch(source, /docs\/search\?api-version/);
});

test('built-in Iloilo places are recordable and visibly labeled demo data', () => {
  const visitedSource = read('lib/visited-places.ts');
  const mockSource = read('data/mockPlaces.ts');
  const exploreSource = read('components/ExploreDiscovery.tsx');
  const generationSource = read('lib/museum-generation.ts');

  assert.match(visitedSource, /\['mock',\s*'geoapify',\s*'search',\s*'manual'\]/);
  assert.equal((mockSource.match(/isDemo:\s*true/g) ?? []).length, 4);
  assert.match(exploreSource, /Demo archive/);
  assert.doesNotMatch(generationSource, /buildMockMemoryInput/);
});

test('museum cloud processing is explicit and privacy disclosed', () => {
  const museumSource = read('components/MuseumExperience.tsx');
  const consentSource = read('components/CloudCurationConsent.tsx');

  assert.match(museumSource, /CloudCurationConsent/);
  assert.doesNotMatch(museumSource, /void loadFoundryStory\(\);/);
  assert.match(consentSource, /sent to Microsoft Azure/i);
  assert.match(consentSource, /I consent/i);
  assert.match(consentSource, /status\.agentConfigured/);
});

test('manual places work without Geoapify and photo uploads are bounded', () => {
  const source = read('components/AddMemoryScreen.tsx');

  assert.match(source, /buildManualPlace/);
  assert.match(source, /MAX_PHOTO_BYTES\s*=\s*3\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /image\/png/);
  assert.match(source, /image\/webp/);
});

test('repository contains the required submission and legal artifacts', () => {
  for (const path of [
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'docs/architecture.md',
    'docs/architecture.svg',
    'docs/PRIVACY.md',
    'docs/SECURITY.md',
    'docs/ASSET_RIGHTS.md',
    'docs/SUBMISSION_CHECKLIST.md',
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} is missing`);
  }

  const readme = read('README.md');
  const archiveUi = read('components/ArchiveUI.tsx');
  const styles = read('app/globals.css');
  assert.match(readme, /Demo Video/);
  assert.match(readme, /Architecture/);
  assert.match(readme, /Privacy/);
  assert.equal((readme.match(/GitHub Copilot, using MAI-Code-1-Flash/g) ?? []).length, 1);
  assert.doesNotMatch(archiveUi, /@\/reference/);
  assert.doesNotMatch(styles, /reference\/.*\.png/);
});

test('security headers and repository cleanup are configured', () => {
  const config = read('next.config.js');
  const ignore = read('.gitignore');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /Permissions-Policy/);
  assert.match(ignore, /\.DS_Store/);
  assert.match(ignore, /\*\.tsbuildinfo/);
  assert.match(packageJson.dependencies.next, /^16\./);
});
