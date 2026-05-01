import type { Context, Next, MiddlewareHandler } from 'hono';
import type { AppEnv, Rol, AuthUser } from '../types';

type HonoVariables = { user: AuthUser };

// Factory: genera un middleware que exige que el usuario tenga uno de los roles indicados.
export function requireRole(
  ...roles: Rol[]
): MiddlewareHandler<{ Bindings: AppEnv; Variables: HonoVariables }> {
  return async (
    c: Context<{ Bindings: AppEnv; Variables: HonoVariables }>,
    next: Next
  ): Promise<Response | void> => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } },
        401
      );
    }
    if (!roles.includes(user.rol)) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `Acceso denegado. Roles permitidos: ${roles.join(', ')}`,
          },
        },
        403
      );
    }
    await next();
  };
}

// Shorthand para los permisos más comunes
export const soloAdmin = requireRole('admin');
export const adminOJefatura = requireRole('admin', 'jefatura');
export const adminJefaturaOSupervisor = requireRole('admin', 'jefatura', 'supervisor');
export const todosLosRoles = requireRole('admin', 'jefatura', 'supervisor', 'lectura');
