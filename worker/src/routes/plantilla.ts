import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import {
  getPersonas,
  getPersonaById,
  createPersona,
  updatePersona,
} from '../db/queries';
import { withAudit } from '../middleware/audit';
import { adminOJefatura, todosLosRoles } from '../middleware/rbac';

type Variables = { user: AuthUser };

const plantilla = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const crearPersonaSchema = z.object({
  codigo_empleado: z.string().min(1).max(20),
  nombre: z.string().min(2).max(100),
  subarea: z.enum(['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes']),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo_contrato: z.enum(['permanente', 'temporal']).default('permanente'),
});

const actualizarPersonaSchema = crearPersonaSchema.partial().extend({
  estado: z.enum(['activo', 'inactivo', 'suspendido']).optional(),
});

const bajaSchema = z.object({
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo_categoria: z.enum(['enfermedad', 'permiso_personal', 'falta_relevo', 'emergencia_operativa', 'vacaciones', 'otro']),
});

// GET /personas — lista personas activas
plantilla.get('/', todosLosRoles, async (c) => {
  const user = c.get('user');
  const personas = await getPersonas(c.env.DB);

  // Rol lectura solo ve versión anonimizada
  if (user.rol === 'lectura') {
    const anonimizadas = personas.map((p) => ({
      id: p.id,
      subarea: p.subarea,
      turno: null,
      estado: p.estado,
      tipo_contrato: p.tipo_contrato,
    }));
    return c.json({ data: anonimizadas });
  }

  return c.json({ data: personas });
});

// GET /personas/:id — detalle de persona
plantilla.get('/:id', adminOJefatura, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const persona = await getPersonaById(c.env.DB, id);
  if (!persona) return c.json({ error: { code: 'NOT_FOUND', message: 'Persona no encontrada' } }, 404);

  return c.json({ data: persona });
});

// POST /personas — crea persona
plantilla.post('/', adminOJefatura, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = crearPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');
  let nuevoId = 0;

  await withAudit(c.env.DB, user.email, 'persona', 0, 'INSERT', null, async () => {
    const result = await createPersona(c.env.DB, {
      ...parsed.data,
      area: 'servicios_generales',
      fecha_baja: null,
      estado: 'activo',
    });
    nuevoId = result.meta.last_row_id as number;
    return result;
  });

  return c.json({ data: { id: nuevoId, mensaje: 'Persona creada' } }, 201);
});

// PATCH /personas/:id — actualiza persona
plantilla.patch('/:id', adminOJefatura, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const persona = await getPersonaById(c.env.DB, id);
  if (!persona) return c.json({ error: { code: 'NOT_FOUND', message: 'Persona no encontrada' } }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = actualizarPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');

  const datos = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  ) as Parameters<typeof updatePersona>[2];

  await withAudit(c.env.DB, user.email, 'persona', id, 'UPDATE', persona, async () => {
    return updatePersona(c.env.DB, id, datos);
  });

  return c.json({ data: { mensaje: 'Persona actualizada' } });
});

// POST /personas/:id/baja — baja con fecha y motivo categórico
plantilla.post('/:id/baja', adminOJefatura, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } }, 400);

  const persona = await getPersonaById(c.env.DB, id);
  if (!persona) return c.json({ error: { code: 'NOT_FOUND', message: 'Persona no encontrada' } }, 404);
  if (persona.estado !== 'activo') {
    return c.json({ error: { code: 'CONFLICT', message: 'La persona ya está inactiva o suspendida' } }, 409);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = bajaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');

  await withAudit(c.env.DB, user.email, 'persona', id, 'UPDATE', persona, async () => {
    return updatePersona(c.env.DB, id, {
      estado: 'inactivo',
      fecha_baja: parsed.data.fecha_baja,
    });
  });

  return c.json({ data: { mensaje: 'Baja registrada' } });
});

export default plantilla;
