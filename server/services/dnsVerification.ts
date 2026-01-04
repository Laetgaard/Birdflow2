import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

export function generateVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'saasify-verify-';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function verifyDnsTxtRecord(domain: string, expectedToken: string): Promise<{ verified: boolean; error?: string }> {
  try {
    const txtRecords = await resolveTxt(`_saasify-verification.${domain}`);
    
    const flatRecords = txtRecords.map(record => record.join(''));
    
    if (flatRecords.includes(expectedToken)) {
      return { verified: true };
    }
    
    return { 
      verified: false, 
      error: `TXT record not found. Expected: ${expectedToken}` 
    };
  } catch (err: any) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      return { 
        verified: false, 
        error: 'TXT record not found. Please add the DNS record and try again.' 
      };
    }
    return { 
      verified: false, 
      error: `DNS lookup failed: ${err.message}` 
    };
  }
}

export async function verifyCnameRecord(domain: string, expectedTarget: string): Promise<{ verified: boolean; error?: string }> {
  try {
    const resolveCname = promisify(dns.resolveCname);
    const cnameRecords = await resolveCname(domain);
    
    const normalizedExpected = expectedTarget.toLowerCase().replace(/\.$/, '');
    const found = cnameRecords.some(record => 
      record.toLowerCase().replace(/\.$/, '') === normalizedExpected
    );
    
    if (found) {
      return { verified: true };
    }
    
    return { 
      verified: false, 
      error: `CNAME record does not point to ${expectedTarget}. Found: ${cnameRecords.join(', ')}` 
    };
  } catch (err: any) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      return { 
        verified: false, 
        error: 'CNAME record not found. Please add the DNS record and try again.' 
      };
    }
    return { 
      verified: false, 
      error: `DNS lookup failed: ${err.message}` 
    };
  }
}

export function getDnsInstructions(domain: string, verificationToken: string, vercelProjectDomain: string): {
  txtRecord: { type: string; name: string; value: string };
  cnameRecord: { type: string; name: string; value: string };
} {
  return {
    txtRecord: {
      type: 'TXT',
      name: `_saasify-verification.${domain}`,
      value: verificationToken,
    },
    cnameRecord: {
      type: 'CNAME',
      name: domain,
      value: vercelProjectDomain,
    },
  };
}
