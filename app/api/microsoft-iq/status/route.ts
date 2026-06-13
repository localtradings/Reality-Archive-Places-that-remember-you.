import { NextResponse } from 'next/server';
import { getMicrosoftIqConfigStatus } from '@/lib/microsoft-iq';
import { getMicrosoftIqSessionFromRequest } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const status = getMicrosoftIqConfigStatus();

  const response = NextResponse.json({
    enabled: status.enabled,
    configured: status.configured,
    agentConfigured: status.agentConfigured,
    indexNamePresent: status.indexNamePresent,
    knowledgeBaseNamePresent: status.knowledgeBaseNamePresent,
    authenticated: Boolean(getMicrosoftIqSessionFromRequest(request)),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
