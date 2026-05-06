import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import { getTurnosConfig, upsertTurnoConfig } from '../db/queries';
import { adminOJefatura, todosLosRoles } from '../middleware/rbac';

type Variables = { user: AuthUser };

const turnos = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

// GET /turnos — lista todos los turnos configurados
turnos.get('/', todosLosRoles, async (c) => {
  const lista = await getTurnosConfig(c.env.DB);
  return c.json({ data: lista });
});

const turnoSchema = z.object({
  codigo: z.string().min(1).max(10),
  nombre: z.string().min(1).max(60),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
  horas_duracion: z.number().positive().max(24),
  cruza_medianoche: z.union([z.literal(0), z.literal(1)]),
  activo: z.union([z.literal(0), z.literal(1)]).default(1),
});

// PUT /turnos/:codigo — crea o actualiza un turno
turnos.put('/:codigo', adminOJefatura, async (c) => {
  const codigo = c.req.param('codigo');
  const body = await c.req.json().catch(() => null);
  const parsed = turnoSchema.safeParse({ ...body, codigo });
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }
  await upsertTurnoConfig(c.env.DB, parsed.data);
  return c.json({ data: { mensaje: `Turno ${codigo} guardado` } });
});

export default turnos;
