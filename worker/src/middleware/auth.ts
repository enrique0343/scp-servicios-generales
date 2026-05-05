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

  // Sin token: acceso abierto — usar primer admin activo
  if (!sessionToken) {
    const defaultUser = await c.env.DB
      .prepare(`SELECT * FROM usuario WHERE activo = 1 AND rol = 'admin' ORDER BY id LIMIT 1`)
      .first<{ email: string; rol: string }>();
    if (defaultUser) {
      c.set('user', { email: defaultUser.email, rol: defaultUser.rol as AuthUser['rol'] });
      await next();
      return;
    }
    return c.json({ error: { code: 'MISSING_TOKEN', message: 'Sesión requerida' } }, 401);
  }

  const email = sessions.get(sessionToken);
  if (!email) {
    // Token no reconocido (sesión expirada o Worker reiniciado) — usar bypass admin
    const defaultUser = await c.env.DB
      .prepare(`SELECT * FROM usuario WHERE activo = 1 AND rol = 'admin' ORDER BY id LIMIT 1`)
      .first<{ email: string; rol: string }>();
    if (defaultUser) {
      c.set('user', { email: defaultUser.email, rol: defaultUser.rol as AuthUser['rol'] });
      await next();
      return;
    }
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Sesión inválida o expirada' } }, 401);
  }

  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }, 401);
  }

  c.set('user', { email: usuario.email, rol: usuario.rol });
  c.executionCtx.waitUntil(updateUltimoAcceso(c.env.DB, email));
  await next();
}
