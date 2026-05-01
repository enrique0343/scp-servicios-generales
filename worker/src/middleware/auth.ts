import type { Context, Next } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, updateUltimoAcceso } from '../db/queries';

type HonoVariables = { user: AuthUser };

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

  // Buscar JWT en header primero, luego en cookie CF_Authorization
  let jwt = c.req.header('Cf-Access-Jwt-Assertion');

  if (!jwt) {
    const cookieHeader = c.req.header('Cookie') ?? '';
    const match = cookieHeader.match(/CF_Authorization=([^;]+)/);
    jwt = match?.[1] ?? undefined;
  }

  if (!jwt) {
    return c.json({
      error: { code: 'MISSING_TOKEN', message: 'Token de acceso requerido' },
    }, 401);
  }

  const result = await validateCfAccessJwt(jwt, c.env.ACCESS_AUD, c.env.ACCESS_TEAM_DOMAIN);

  if (!result.ok) {
    return c.json({
      error: { code: 'INVALID_TOKEN', message: result.error },
    }, 401);
  }

  const usuario = await getUsuarioByEmail(c.env.DB, result.email);
  if (!usuario) {
    return c.json({
      error: { code: 'USER_NOT_FOUND', message: `Email ${result.email} no autorizado en el sistema` },
    }, 401);
  }

  c.set('user', { email: usuario.email, rol: usuario.rol });
  c.executionCtx.waitUntil(updateUltimoAcceso(c.env.DB, result.email));

  await next();
}

type JwtResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

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

function decodeJwtPart<T>(b64url: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlToBytes(b64url))) as T;
}

async function validateCfAccessJwt(
  token: string,
  audience: string,
  teamDomain: string
): Promise<JwtResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { ok: false, error: `JWT malformado: ${parts.length} partes` };
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    let header: { kid?: string; alg?: string };
    let payload: { email?: string; aud?: string | string[]; exp?: number };

    try {
      header = decodeJwtPart(headerB64);
    } catch (e) {
      return { ok: false, error: `Header inválido: ${String(e)}` };
    }

    try {
      payload = decodeJwtPart(payloadB64);
    } catch (e) {
      return { ok: false, error: `Payload inválido: ${String(e)}` };
    }

    // Validar expiración
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, error: `Token expirado (exp: ${payload.exp ?? 'undefined'})` };
    }

    // Validar audience
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? ''];
    if (!aud.includes(audience)) {
      return { ok: false, error: `Audience inválido. Token tiene: ${aud.join(',')} | Esperado: ${audience}` };
    }

    // Obtener JWKS
    const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
    let certsRes: Response;
    try {
      certsRes = await fetch(certsUrl);
    } catch (e) {
      return { ok: false, error: `No se pudo obtener JWKS: ${String(e)}` };
    }

    if (!certsRes.ok) {
      return { ok: false, error: `JWKS endpoint retornó ${certsRes.status}` };
    }

    const jwks = await certsRes.json<{ keys: Array<JsonWebKey & { kid?: string }> }>();
    const jwk = jwks.keys.find((k) => k.kid === header.kid);

    if (!jwk) {
      return {
        ok: false,
        error: `kid '${header.kid}' no encontrado en JWKS. Kids disponibles: ${jwks.keys.map((k) => k.kid).join(', ')}`,
      };
    }

    // Cloudflare Access usa ES256 (ECDSA P-256 + SHA-256)
    // Si el alg es RS256, usar RSA en su lugar
    let cryptoKey: CryptoKey;
    const alg = header.alg ?? 'ES256';

    try {
      if (alg === 'RS256') {
        cryptoKey = await crypto.subtle.importKey(
          'jwk', jwk,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false, ['verify']
        );
      } else {
        // ES256 por defecto
        cryptoKey = await crypto.subtle.importKey(
          'jwk', jwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false, ['verify']
        );
      }
    } catch (e) {
      return { ok: false, error: `Error importando clave (alg=${alg}): ${String(e)}` };
    }

    const signingInput = `${headerB64}.${payloadB64}`;
    let valid: boolean;

    try {
      const verifyAlg = alg === 'RS256'
        ? 'RSASSA-PKCS1-v1_5'
        : { name: 'ECDSA', hash: 'SHA-256' };

      valid = await crypto.subtle.verify(
        verifyAlg,
        cryptoKey,
        base64urlToBytes(signatureB64),
        new TextEncoder().encode(signingInput)
      );
    } catch (e) {
      return { ok: false, error: `Error verificando firma: ${String(e)}` };
    }

    if (!valid) {
      return { ok: false, error: 'Firma inválida' };
    }

    if (!payload.email) {
      return { ok: false, error: 'Token no contiene email' };
    }

    return { ok: true, email: payload.email };
  } catch (e) {
    return { ok: false, error: `Error inesperado: ${String(e)}` };
  }
}
