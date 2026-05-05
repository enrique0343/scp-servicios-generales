import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import {
  getAsistenciaByFecha,
  upsertAsistencia,
  cerrarDia,
  getExcepcionesPendientesPorFecha,
} from '../db/queries';
import { withAudit } from '../middleware/audit';
import { adminOJefatura, adminJefaturaOSupervisor, todosLosRoles } from '../middleware/rbac';
import { validarCierreDiario } from '../domain/cierreDiario';

type Variables = { user: AuthUser };

const asistencia = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const registroSchema = z.object({
  persona_id: z.number().int().positive(),
  turno_planificado: z.enum(['D', 'N', 'descanso']),
  turno_real: z.enum(['D', 'N', 'descanso', 'doble']),
  estado: z.enum([
    'presente',
    'ausente_justificado',
    'ausente_injustificado',
    'sustitucion',
    'doble_turno',
    'permiso',
    'incapacidad',
    'vacaciones',
  ]),
  hora_entrada: z.string().nullable().optional(),
  hora_salida: z.string().nullable().optional(),
  horas_trabajadas: z.number().min(0).default(0),
});

// GET /asistencia/:fecha — asistencia del día
asistencia.get('/:fecha', todosLosRoles, async (c) => {
  const fecha = c.req.param('fecha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM-DD' } }, 400);
  }

  const registros = await getAsistenciaByFecha(c.env.DB, fecha);
  return c.json({ data: registros });
});

// POST /asistencia/:fecha — registra o actualiza línea de asistencia
asistencia.post('/:fecha', adminJefaturaOSupervisor, async (c) => {
  const fecha = c.req.param('fecha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM-DD' } }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = registroSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  // Impedir registro en día ya cerrado
  const existentes = await getAsistenciaByFecha(c.env.DB, fecha);
  const lineCerrada = existentes.find((r) => r.persona_id === parsed.data.persona_id && r.cerrado === 1);
  if (lineCerrada) {
    return c.json({ error: { code: 'DIA_CERRADO', message: 'El registro de este día ya fue cerrado' } }, 409);
  }

  const user = c.get('user');

  await withAudit(c.env.DB, user.email, 'asistencia_diaria', parsed.data.persona_id, 'INSERT', null, async () => {
    return upsertAsistencia(c.env.DB, {
      ...parsed.data,
      fecha,
      hora_entrada: parsed.data.hora_entrada ?? null,
      hora_salida: parsed.data.hora_salida ?? null,
      registrado_por: user.email,
      cerrado: 0,
      cerrado_por: null,
      cerrado_en: null,
    });
  });

  return c.json({ data: { mensaje: 'Asistencia registrada' } }, 201);
});

// POST /asistencia/:fecha/cerrar — cierra el día
asistencia.post('/:fecha/cerrar', adminOJefatura, async (c) => {
  const fecha = c.req.param('fecha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM-DD' } }, 400);
  }

  // Verifica que no haya desviaciones sin excepción
  const pendientes = await getExcepcionesPendientesPorFecha(c.env.DB, fecha);
  if (pendientes > 0) {
    return c.json({
      error: {
        code: 'EXCEPCIONES_PENDIENTES',
        message: `Hay ${pendientes} desviación(es) sin excepción registrada. Registrar antes de cerrar.`,
      },
    }, 409);
  }

  const asistencias = await getAsistenciaByFecha(c.env.DB, fecha);
  const excepciones: Parameters<typeof validarCierreDiario>[1] = [];
  const resultado = validarCierreDiario(asistencias, excepciones, fecha);

  if (!resultado.puede_cerrar) {
    return c.json({
      error: {
        code: 'CIERRE_BLOQUEADO',
        message: 'No se puede cerrar el día',
        details: resultado.motivos_bloqueo,
      },
    }, 409);
  }

  const user = c.get('user');
  await cerrarDia(c.env.DB, fecha, user.email);

  return c.json({ data: { mensaje: `Día ${fecha} cerrado` } });
});

// GET /asistencia/:fecha/vista — plan + asistencia merged con nombres
asistencia.get('/:fecha/vista', todosLosRoles, async (c) => {
  const fecha = c.req.param('fecha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM-DD' } }, 400);
  }

  const planRows = await c.env.DB.prepare(`
    SELECT pm.persona_id, pm.turno AS turno_planificado, pm.subarea_asignada,
           p.nombre, p.subarea, p.codigo_empleado
    FROM plan_mensual pm
    JOIN persona p ON pm.persona_id = p.id
    WHERE pm.fecha = ? AND pm.turno != 'descanso'
    ORDER BY p.subarea, p.nombre
  `).bind(fecha).all<{
    persona_id: number; turno_planificado: string; subarea_asignada: string;
    nombre: string; subarea: string; codigo_empleado: string;
  }>();

  const asistenciaRows = await c.env.DB.prepare(`
    SELECT ad.*, p.nombre, p.subarea, p.codigo_empleado
    FROM asistencia_diaria ad
    JOIN persona p ON ad.persona_id = p.id
    WHERE ad.fecha = ?
    ORDER BY p.subarea, p.nombre
  `).bind(fecha).all<Record<string, unknown>>();

  const asistenciaMap = new Map(asistenciaRows.results.map((a) => [a['persona_id'] as number, a]));
  const planSet = new Set(planRows.results.map((p) => p.persona_id));

  const lineasPlan = planRows.results.map((plan) => ({
    persona_id: plan.persona_id,
    codigo_empleado: plan.codigo_empleado,
    nombre: plan.nombre,
    subarea: plan.subarea,
    en_plan: true,
    turno_planificado: plan.turno_planificado,
    subarea_planificada: plan.subarea_asignada,
    asistencia: asistenciaMap.get(plan.persona_id) ?? null,
  }));

  const lineasExtra = asistenciaRows.results
    .filter((a) => !planSet.has(a['persona_id'] as number))
    .map((a) => ({
      persona_id: a['persona_id'] as number,
      codigo_empleado: a['codigo_empleado'] as string,
      nombre: a['nombre'] as string,
      subarea: a['subarea'] as string,
      en_plan: false,
      turno_planificado: null,
      subarea_planificada: null,
      asistencia: a,
    }));

  const lineas = [...lineasPlan, ...lineasExtra];
  const ausenciaEstados = ['ausente_justificado', 'ausente_injustificado', 'incapacidad', 'permiso', 'vacaciones'];

  return c.json({
    data: {
      fecha,
      lineas,
      resumen: {
        planificados: lineasPlan.length,
        presentes: lineas.filter((l) => l.asistencia && ['presente', 'doble_turno', 'sustitucion'].includes(l.asistencia['estado'] as string)).length,
        ausentes: lineas.filter((l) => l.asistencia && ausenciaEstados.includes(l.asistencia['estado'] as string)).length,
        sin_registro: lineasPlan.filter((l) => !l.asistencia).length,
        horas_totales: lineas.reduce((s, l) => s + ((l.asistencia?.['horas_trabajadas'] as number) ?? 0), 0),
      },
    },
  });
});

export default asistencia;
