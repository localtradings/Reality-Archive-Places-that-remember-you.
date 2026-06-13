'use client';

import { useEffect, useState } from 'react';

type CloudCurationState = 'idle' | 'loading' | 'live' | 'prepared' | 'error';

interface CloudCurationConsentProps {
  state: CloudCurationState;
  reason: string;
  onGenerate: (accessCode?: string) => Promise<void>;
}

interface MicrosoftIqStatus {
  enabled: boolean;
  configured: boolean;
  agentConfigured: boolean;
  authenticated: boolean;
}

function isStatus(value: unknown): value is MicrosoftIqStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).enabled === 'boolean' &&
    typeof (value as Record<string, unknown>).configured === 'boolean' &&
    typeof (value as Record<string, unknown>).agentConfigured === 'boolean' &&
    typeof (value as Record<string, unknown>).authenticated === 'boolean'
  );
}

export function CloudCurationConsent({ state, reason, onGenerate }: CloudCurationConsentProps) {
  const [consented, setConsented] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [status, setStatus] = useState<MicrosoftIqStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch('/api/microsoft-iq/status', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as unknown;
        if (active && response.ok && isStatus(data)) {
          setStatus(data);
        }
      } catch {
        if (active) {
          setStatus({ enabled: false, configured: false, agentConfigured: false, authenticated: false });
        }
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerate() {
    setError('');
    if (!consented) {
      setError('Confirm consent before using Microsoft cloud curation.');
      return;
    }

    if (!status?.authenticated && !accessCode.trim()) {
      setError('Enter the private demo access code.');
      return;
    }

    try {
      await onGenerate(status?.authenticated ? undefined : accessCode.trim());
      setStatus((current) => (current ? { ...current, authenticated: true } : current));
      setAccessCode('');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Cloud curation could not be started.');
    }
  }

  const cloudReady = Boolean(status?.enabled && status.configured && status.agentConfigured);

  return (
    <section className="cloud-curation-consent" aria-label="Microsoft cloud curation consent">
      <div>
        <p className="museum-detail-kicker">Optional Microsoft cloud curation</p>
        <h3>Your archive stays local until you choose this.</h3>
        <p>
          If enabled, the selected place details, memory text, photo captions, and voice transcripts are sent to Microsoft Azure
          for Foundry IQ retrieval and story generation. Photo files and recorded audio remain on this device.
        </p>
      </div>

      <label className="cloud-curation-consent__check">
        <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
        <span>I consent to send this archive text to Microsoft Azure for this request.</span>
      </label>

      {!status?.authenticated ? (
        <label className="cloud-curation-consent__code">
          <span>Private demo access code</span>
          <input
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            autoComplete="off"
            disabled={!cloudReady || state === 'loading'}
          />
        </label>
      ) : null}

      <button
        type="button"
        className="museum-reference-open"
        disabled={!cloudReady || state === 'loading'}
        onClick={handleGenerate}
      >
        {state === 'loading' ? 'Curating...' : state === 'live' ? 'Refresh live story' : 'Create live story'}
      </button>

      {!cloudReady ? (
        <p className="cloud-curation-consent__status">
          Live Foundry IQ is unavailable until a real Azure AI Search knowledge base and server security settings are configured.
        </p>
      ) : null}
      {reason && state === 'prepared' ? <p className="cloud-curation-consent__status">{reason}</p> : null}
      {error ? <p className="memory-reference-error">{error}</p> : null}
    </section>
  );
}
