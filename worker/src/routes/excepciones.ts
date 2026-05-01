import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import { getExcepciones, createExcepcion } from '../db/queries';
import { withAudit } from '../middleware/audit';
import { adminJefaturaOSupervisor, todosLosRoles } from '../middleware/rbac';

type Variables = { user: AuthUser };

const excepciones = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const excepcionBaseSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  persona_afectada_id: z.number().int().positive(),
  tipo: z.enum(['ausencia', 'sustitucion', 'doble_turno', 'cambio_area', 'cambio_turno']),
  motivo_categoria: z.enum([
    'enfermedad',
    'permiso_personal',
    'falta_relevo',
    'emergencia_operativa',
    'vacaciones',
    'otro',
  ]),
  motivo_detalle: z.string().max(200).nullable().optional(),
  persona_sustituta_id: z.number().int().positive().nullable().optional(),
  horas_extra_generadas: z.number().min(0).default(0),
  clasificacion_he: z
    .enum(['planificada', 'por_fallo_cobertura', 'por_demanda'])
    .nullable()
    .optional(),
});

const crearExcepcionSchema = excepcionBaseSchema.refine(
  (d) => d.horas_extra_generadas === 0 || d.clasificacion_he !== null,
  { message: 'clasificacion_he es requerida cuando horas_extra_generadas > 0', path: ['clasificacion_he'] }
);

// GET /excepciones?desde&hasta&tipo — lista excepciones
excepciones.get('/', todosLosRoles, async (c) => {
  const desde = c.req.query('desde') ?? new Date().toISOString().slice(0, 7) + '-01';
  const hasta = c.req.query('hasta') ?? new Date().toISOString().slice(0, 10);
  const tipo = c.req.query('tipo');

  const lista = await getExcepciones(c.env.DB, desde, hasta, tipo);
  return c.json({ data: lista });
});

// POST /excepciones — registra excepción
excepciones.post('/', adminJefaturaOSupervisor, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = crearExcepcionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');
  let nuevoId = 0;

  await withAudit(c.env.DB, user.email, 'excepcion', 0, 'INSERT', null, async () => {
    const result = await createExcepcion(c.env.DB, {
      ...parsed.data,
      motivo_detalle: parsed.data.motivo_detalle ?? null,
      persona_sustituta_id: parsed.data.persona_sustituta_id ?? null,
      clasificacion_he: parsed.data.clasificacion_he ?? null,
      autorizado_por: user.email,
    });
    nuevoId = result.meta.last_row_id as number;
    return result;
  });

  return c.json({ data: { id: nuevoId, mensaje: 'Excepción registrada' } }, 201);
});

// PATCH /excepciones/:id — actualiza excepción (autorizar)
excepciones.patch('/:id', adminJefaturaOSupervisor, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const body = await c.req.json().catch(() => null);
  const schema = excepcionBaseSchema.partial();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');

  const fields = Object.keys(parsed.data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = [...Object.values(parsed.data), id];

  await withAudit(c.env.DB, user.email, 'excepcion', id, 'UPDATE', null, async () => {
    return c.env.DB.prepare(`UPDATE excepcion SET ${fields} WHERE id = ?`).bind(...values).run();
  });

  return c.json({ data: { mensaje: 'Excepción actualizada' } });
});

export default excepciones;
