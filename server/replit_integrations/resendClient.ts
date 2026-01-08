import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentialsFromConnector(): Promise<{ apiKey: string; fromEmail: string } | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!hostname) {
      console.log('[Resend] REPLIT_CONNECTORS_HOSTNAME not set, connector unavailable');
      return null;
    }

    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      console.log('[Resend] No REPL_IDENTITY or WEB_REPL_RENEWAL token available');
      return null;
    }

    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      console.error('[Resend] Connector API returned error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || !connectionSettings.settings?.api_key) {
      console.log('[Resend] Connector returned no settings or API key');
      return null;
    }

    console.log('[Resend] Successfully retrieved credentials from connector');
    return { 
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email || 'info@bird-flow.com'
    };
  } catch (error) {
    console.error('[Resend] Error fetching credentials from connector:', error);
    return null;
  }
}

function getCredentialsFromEnv(): { apiKey: string; fromEmail: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Resend] RESEND_API_KEY environment variable not set');
    return null;
  }
  console.log('[Resend] Using RESEND_API_KEY from environment variable');
  return { apiKey, fromEmail: 'info@bird-flow.com' };
}

export async function getUncachableResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  // Try connector first, then fall back to environment variable
  let credentials = await getCredentialsFromConnector();
  
  if (!credentials) {
    credentials = getCredentialsFromEnv();
  }

  if (!credentials) {
    throw new Error('Resend not configured: Neither connector nor RESEND_API_KEY available');
  }

  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}
