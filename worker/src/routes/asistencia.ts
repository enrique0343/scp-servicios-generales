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

export default asistencia;
