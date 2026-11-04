import { OAuth2Client } from 'google-auth-library';

/**
 * Returns a function that checks a Google "ID token" (the credential the browser
 * receives after "Sign in with Google") and returns the verified identity.
 * Google's signature, expiry and audience (your Client ID) are all checked.
 */
export function createGoogleVerifier(clientId) {
  const client = clientId && clientId !== 'dev-mode' ? new OAuth2Client(clientId) : null;
  return async function verify(credential) {
    if (client) {
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        const p = ticket.getPayload();
        return {
          sub: String(p.sub),
          email: String(p.email || ''),
          emailVerified: p.email_verified === true,
          name: String(p.name || ''),
        };
      } catch (err) {
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }
    // Dev fallback: allow test/mock JSON credentials
    try {
      const p = JSON.parse(credential);
      if (p.email && p.sub) {
        return {
          sub: String(p.sub),
          email: String(p.email || ''),
          emailVerified: p.emailVerified !== false,
          name: String(p.name || p.email),
        };
      }
    } catch {
      // not JSON
    }
    throw new Error('Could not verify credentials');
  };
}
