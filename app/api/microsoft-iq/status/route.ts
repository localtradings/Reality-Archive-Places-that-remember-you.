import { NextResponse } from 'next/server';
import { getMicrosoftIqConfigStatus } from '@/lib/microsoft-iq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = getMicrosoftIqConfigStatus();

  return NextResponse.json({
    enabled: status.enabled,
    configured: status.configured,
    agentConfigured: status.agentConfigured,
    missingVariables: status.missingVariables,
    missingAgentVariables: status.missingAgentVariables,
    indexNamePresent: status.indexNamePresent,
    knowledgeBaseNamePresent: status.knowledgeBaseNamePresent,
  });
}
