import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser, EstadoAsistencia, MotivoCategoria } from '../types';
import {
  getExcepciones,
  createExcepcion,
  getAsistenciaByPersonaFecha,
  upsertAsistencia,
  getPlanByPersonaFecha,
} from '../db/queries';
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

// Mapea motivo_categoria al estado de asistencia del afectado
function estadoAfectado(motivo: MotivoCategoria): EstadoAsistencia {
  if (motivo === 'enfermedad') return 'incapacidad';
  if (motivo === 'permiso_personal') return 'permiso';
  if (motivo === 'vacaciones') return 'vacaciones';
  return 'ausente_justificado';
}

// Crea asistencia si no existe; si existe, solo actualiza el estado
async function aplicarAsistencia(
  db: D1Database,
  persona_id: number,
  fecha: string,
  estado: EstadoAsistencia,
  turno_real: 'D' | 'N' | 'descanso' | 'doble',
  horas_trabajadas: number,
  registrado_por: string
): Promise<void> {
  const existente = await getAsistenciaByPersonaFecha(db, persona_id, fecha);
  if (existente) {
    // Solo actualiza estado si el día no está cerrado
    if (!existente.cerrado) {
      await db
        .prepare(`UPDATE asistencia_diaria SET estado = ?, turno_real = ?, horas_trabajadas = ?, registrado_por = ? WHERE persona_id = ? AND fecha = ?`)
        .bind(estado, turno_real, horas_trabajadas, registrado_por, persona_id, fecha)
        .run();
    }
    return;
  }
  // Obtiene turno planificado del plan mensual
  const yyyymm = fecha.slice(0, 7);
  const plan = await getPlanByPersonaFecha(db, persona_id, fecha);
  const turno_planificado = plan?.turno ?? 'D';
  await upsertAsistencia(db, {
    persona_id,
    fecha,
    turno_planificado,
    turno_real,
    estado,
    hora_entrada: null,
    hora_salida: null,
    horas_trabajadas,
    registrado_por,
    cerrado: 0,
    cerrado_por: null,
    cerrado_en: null,
  });
  // Evita unused variable warning
  void yyyymm;
}

// POST /excepciones — registra excepción y aplica asistencia automáticamente
excepciones.post('/', adminJefaturaOSupervisor, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = crearExcepcionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const { fecha, persona_afectada_id, persona_sustituta_id, tipo, motivo_categoria, horas_extra_generadas } = parsed.data;
  const user = c.get('user');
  let nuevoId = 0;

  await withAudit(c.env.DB, user.email, 'excepcion', 0, 'INSERT', null, async () => {
    const result = await createExcepcion(c.env.DB, {
      ...parsed.data,
      motivo_detalle: parsed.data.motivo_detalle ?? null,
      persona_sustituta_id: persona_sustituta_id ?? null,
      clasificacion_he: parsed.data.clasificacion_he ?? null,
      autorizado_por: user.email,
    });
    nuevoId = result.meta.last_row_id as number;
    return result;
  });

  // — Asistencia persona afectada (ausente/permiso/incapacidad/vacaciones) —
  const estadoAusente = estadoAfectado(motivo_categoria);
  await aplicarAsistencia(c.env.DB, persona_afectada_id, fecha, estadoAusente, 'descanso', 0, user.email);

  // — Asistencia persona sustituta (si aplica) —
  if (persona_sustituta_id) {
    const esDoble = tipo === 'doble_turno';
    const estadoSust: EstadoAsistencia = esDoble ? 'doble_turno' : 'sustitucion';
    const turnoReal: 'D' | 'N' | 'doble' = esDoble ? 'doble' : 'D';
    const horas = horas_extra_generadas > 0 ? horas_extra_generadas : 12;
    await aplicarAsistencia(c.env.DB, persona_sustituta_id, fecha, estadoSust, turnoReal, horas, user.email);
  }

  const asistenciasAfectadas = persona_sustituta_id ? 2 : 1;
  return c.json({
    data: {
      id: nuevoId,
      mensaje: 'Excepción registrada',
      asistencias_actualizadas: asistenciasAfectadas,
    },
  }, 201);
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
