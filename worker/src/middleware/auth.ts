import type { Context, Next } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, updateUltimoAcceso } from '../db/queries';

type HonoVariables = { user: AuthUser };

export async function authMiddleware(
  c: Context<{ Bindings: AppEnv; Variables: HonoVariables }>,
  next: Next
): Promise<Response | void> {
  // Bypass para desarrollo local (nunca activo en production)
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
  c.executionCtx.waitUntil(updateUltimoAcceso(c.env.DB, email));

  await next();
}

// Convierte base64url → Uint8Array sin depender de atob (que falla con padding incorrecto)
function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64urlToJson<T>(b64url: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlToBytes(b64url))) as T;
}

// Cloudflare Access firma con ES256 (ECDSA P-256 + SHA-256)
async function validateCfAccessJwt(
  token: string,
  audience: string,
  teamDomain: string
): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const header = base64urlToJson<{ kid?: string; alg?: string }>(headerB64);
    const payload = base64urlToJson<{
      email?: string;
      aud?: string | string[];
      exp?: number;
      iss?: string;
    }>(payloadB64);

    // Validar expiración antes de ir a buscar las claves
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Validar audience
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) return null;

    // Obtener JWKS del team domain
    const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
    const certsRes = await fetch(certsUrl, { cf: { cacheTtl: 300 } } as RequestInit);
    if (!certsRes.ok) return null;

    const jwks = await certsRes.json<{ keys: Array<JsonWebKey & { kid?: string }> }>();
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    // Importar clave pública — CF Access usa ES256 (ECDSA con P-256)
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    // Verificar firma: el input es "header.payload" como bytes UTF-8
    const signingInput = `${headerB64}.${payloadB64}`;
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      base64urlToBytes(signatureB64),
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    return payload.email ?? null;
  } catch {
    return null;
  }
}
