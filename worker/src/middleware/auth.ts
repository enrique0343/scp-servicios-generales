import type { Context, Next } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, updateUltimoAcceso } from '../db/queries';

type HonoVariables = { user: AuthUser };

// Valida el JWT de Cloudflare Access y carga el usuario desde D1.
// En modo bypass (solo dev local), acepta el header X-Dev-Email sin validar firma.
export async function authMiddleware(
  c: Context<{ Bindings: AppEnv; Variables: HonoVariables }>,
  next: Next
): Promise<Response | void> {
  // Bypass para desarrollo local
  if (c.env.CF_ACCESS_BYPASS === 'true' && c.env.ENVIRONMENT !== 'production') {
    const devEmail = c.req.header('X-Dev-Email');
    if (devEmail) {
      const usuario = await getUsuarioByEmail(c.env.DB, devEmail);
      if (!usuario) {
        return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no registrado' } }, 401);
      }
      c.set('user', { email: usuario.email, rol: usuario.rol });
      await next();
      return;
    }
  }

  const jwt = c.req.header('Cf-Access-Jwt-Assertion');
  if (!jwt) {
    return c.json({ error: { code: 'MISSING_TOKEN', message: 'Token de acceso requerido' } }, 401);
  }

  const email = await validateCfAccessJwt(jwt, c.env.ACCESS_AUD, c.env.ACCESS_TEAM_DOMAIN);
  if (!email) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token inválido o expirado' } }, 401);
  }

  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no autorizado en el sistema' } }, 401);
  }

  c.set('user', { email: usuario.email, rol: usuario.rol });

  // Actualiza último acceso de forma no bloqueante
  c.executionCtx.waitUntil(updateUltimoAcceso(c.env.DB, email));

  await next();
}

// Valida el JWT de Cloudflare Access contra los JWKS públicos.
// Retorna el email del claim si es válido, null si no.
async function validateCfAccessJwt(
  token: string,
  audience: string,
  teamDomain: string
): Promise<string | null> {
  try {
    const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
    const certsResponse = await fetch(certsUrl);
    if (!certsResponse.ok) return null;

    const { keys } = await certsResponse.json<{ keys: JsonWebKey[] }>();

    const [headerB64, payloadB64] = token.split('.');
    if (!headerB64 || !payloadB64) return null;

    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))) as { kid?: string };
    const key = keys.find((k) => (k as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!key) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const [, , signatureB64] = token.split('.');
    if (!signatureB64) return null;

    const signingInput = token.substring(0, token.lastIndexOf('.'));
    const encoder = new TextEncoder();
    const signatureBytes = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      encoder.encode(signingInput)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    ) as { email?: string; aud?: string | string[]; exp?: number };

    // Valida audience
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) return null;

    // Valida expiración
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload.email ?? null;
  } catch {
    return null;
  }
}
