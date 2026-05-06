import type { Context, Next } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, updateUltimoAcceso } from '../db/queries';

type HonoVariables = { user: AuthUser };

export const sessions = new Map<string, string>();

export async function authMiddleware(
  c: Context<{ Bindings: AppEnv; Variables: HonoVariables }>,
  next: Next
): Promise<Response | void> {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const cookieMatch = cookieHeader.match(/scp_session=([^;]+)/);
  const bearerMatch = (c.req.header('Authorization') ?? '').match(/^Bearer (.+)$/);
  const sessionToken = cookieMatch?.[1] ?? bearerMatch?.[1];

  // Resuelve el admin de bypass: DB o fallback hardcoded
  async function adminBypass(): Promise<{ email: string; rol: string }> {
    const dbUser = await c.env.DB
      .prepare(`SELECT email, rol FROM usuario WHERE activo = 1 AND rol = 'admin' ORDER BY id LIMIT 1`)
      .first<{ email: string; rol: string }>();
    return dbUser ?? { email: 'admin@sistema', rol: 'admin' };
  }

  // Sin token: acceso abierto
  if (!sessionToken) {
    const u = await adminBypass();
    c.set('user', { email: u.email, rol: u.rol as AuthUser['rol'] });
    await next();
    return;
  }

  const email = sessions.get(sessionToken);
  if (!email) {
    // Token no reconocido (sesión expirada o Worker reiniciado)
    const u = await adminBypass();
    c.set('user', { email: u.email, rol: u.rol as AuthUser['rol'] });
    await next();
    return;
  }

  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }, 401);
  }

  c.set('user', { email: usuario.email, rol: usuario.rol });
  c.executionCtx.waitUntil(updateUltimoAcceso(c.env.DB, email));
  await next();
}
