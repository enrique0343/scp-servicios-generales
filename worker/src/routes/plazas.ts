import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import {
  getPlazas,
  getPlazaById,
  createPlaza,
  updatePlaza,
  getCoberturaVigente,
} from '../db/queries';
import { withAudit } from '../middleware/audit';
import { soloAdmin, adminOJefatura, todosLosRoles } from '../middleware/rbac';

type Variables = { user: AuthUser };

const plazas = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const crearPlazaSchema = z.object({
  codigo_plaza: z.string().min(1).max(20),
  subarea: z.enum(['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes']),
  turno_base: z.enum(['D', 'N']),
  estado: z.enum(['autorizada', 'contratada', 'vacante']).default('autorizada'),
  persona_id: z.number().int().positive().nullable().default(null),
});

// GET /plazas — lista plazas
plazas.get('/', todosLosRoles, async (c) => {
  const user = c.get('user');
  const todas = await getPlazas(c.env.DB);

  // Rol lectura solo ve conteo por subárea
  if (user.rol === 'lectura') {
    const conteo = todas.reduce<Record<string, number>>((acc, p) => {
      acc[p.subarea] = (acc[p.subarea] ?? 0) + 1;
      return acc;
    }, {});
    return c.json({ data: { total: todas.length, por_subarea: conteo } });
  }

  return c.json({ data: todas });
});

// GET /plazas/:id — detalle de plaza
plazas.get('/:id', todosLosRoles, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const plaza = await getPlazaById(c.env.DB, id);
  if (!plaza) return c.json({ error: { code: 'NOT_FOUND', message: 'Plaza no encontrada' } }, 404);

  return c.json({ data: plaza });
});

// POST /plazas — crea plaza (solo admin)
plazas.post('/', soloAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = crearPlazaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');
  let nuevoId = 0;

  await withAudit(c.env.DB, user.email, 'plaza', 0, 'INSERT', null, async () => {
    const result = await createPlaza(c.env.DB, parsed.data);
    nuevoId = result.meta.last_row_id as number;
    return result;
  });

  return c.json({ data: { id: nuevoId, mensaje: 'Plaza creada' } }, 201);
});

// PATCH /plazas/:id — actualiza plaza
plazas.patch('/:id', adminOJefatura, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const plaza = await getPlazaById(c.env.DB, id);
  if (!plaza) return c.json({ error: { code: 'NOT_FOUND', message: 'Plaza no encontrada' } }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = crearPlazaSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');

  const datos = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  ) as Parameters<typeof updatePlaza>[2];

  await withAudit(c.env.DB, user.email, 'plaza', id, 'UPDATE', plaza, async () => {
    return updatePlaza(c.env.DB, id, datos);
  });

  return c.json({ data: { mensaje: 'Plaza actualizada' } });
});

// GET /plazas/:id/cobertura — cobertura estándar vigente por plaza (referencia de subárea)
plazas.get('/:id/cobertura', todosLosRoles, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const plaza = await getPlazaById(c.env.DB, id);
  if (!plaza) return c.json({ error: { code: 'NOT_FOUND', message: 'Plaza no encontrada' } }, 404);

  const cobertura = await getCoberturaVigente(c.env.DB);
  const coberturaSubarea = cobertura.filter((cs) => cs.subarea === plaza.subarea);

  return c.json({ data: coberturaSubarea });
});

export default plazas;
