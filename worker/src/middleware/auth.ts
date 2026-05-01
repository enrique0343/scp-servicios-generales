import type { Context, Next } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, updateUltimoAcceso } from '../db/queries';

type HonoVariables = { user: AuthUser };

// Sesiones en memoria (se limpian al reiniciar el Worker — aceptable para V1)
// Clave: token aleatorio, Valor: email del usuario
const sessions = new Map<string, string>();

export { sessions };

export async function authMiddleware(
  c: Context<{ Bindings: AppEnv; Variables: HonoVariables }>,
  next: Next
): Promise<Response | void> {
  // Leer token de sesión desde cookie o header Authorization
  const cookieHeader = c.req.header('Cookie') ?? '';
  const cookieMatch = cookieHeader.match(/scp_session=([^;]+)/);
  const bearerMatch = (c.req.header('Authorization') ?? '').match(/^Bearer (.+)$/);
  const sessionToken = cookieMatch?.[1] ?? bearerMatch?.[1];

  if (!sessionToken) {
    return c.json({ error: { code: 'MISSING_TOKEN', message: 'Sesión requerida' } }, 401);
  }

  const email = sessions.get(sessionToken);
  if (!email) {
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
