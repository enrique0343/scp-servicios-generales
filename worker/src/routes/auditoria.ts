import { Hono } from 'hono';
import type { AppEnv, AuthUser } from '../types';
import { getAuditoriaByTablaRegistro } from '../db/queries';
import { soloAdmin } from '../middleware/rbac';

type Variables = { user: AuthUser };

const auditoria = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

// GET /auditoria?tabla&registro_id — solo admin
auditoria.get('/', soloAdmin, async (c) => {
  const tabla = c.req.query('tabla');
  const registroIdStr = c.req.query('registro_id');

  if (!tabla || !registroIdStr) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Parámetros tabla y registro_id requeridos' } }, 400);
  }

  const registroId = Number(registroIdStr);
  if (isNaN(registroId)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'registro_id debe ser numérico' } }, 400);
  }

  const logs = await getAuditoriaByTablaRegistro(c.env.DB, tabla, registroId);
  return c.json({ data: logs });
});

export default auditoria;
