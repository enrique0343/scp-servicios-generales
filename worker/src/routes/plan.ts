import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import {
  getPlanMensual,
  upsertPlanMensual,
  aprobarPlanMensual,
  mestieneAsistencia,
  getPlazas,
  getCoberturaVigente,
} from '../db/queries';
import { withAudit } from '../middleware/audit';
import { adminOJefatura, todosLosRoles } from '../middleware/rbac';
import { calcularDeficit, validarPlanCompleto } from '../domain/cobertura';

type Variables = { user: AuthUser };

const plan = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const lineaPlanSchema = z.object({
  persona_id: z.number().int().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: z.enum(['D', 'N', 'descanso']),
  subarea_asignada: z.enum(['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes']),
});

const crearPlanSchema = z.object({
  lineas: z.array(lineaPlanSchema).min(1),
});

// GET /plan/:yyyymm — plan del mes
plan.get('/:yyyymm', todosLosRoles, async (c) => {
  const yyyymm = c.req.param('yyyymm');
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM' } }, 400);
  }

  const lineas = await getPlanMensual(c.env.DB, yyyymm);
  return c.json({ data: lineas });
});

// POST /plan/:yyyymm — crea/reemplaza plan borrador
plan.post('/:yyyymm', adminOJefatura, async (c) => {
  const yyyymm = c.req.param('yyyymm');
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM' } }, 400);
  }

  // Un mes con asistencia ya registrada no puede modificarse
  const bloqueado = await mestieneAsistencia(c.env.DB, yyyymm);
  if (bloqueado) {
    return c.json({
      error: {
        code: 'PLAN_LOCKED',
        message: 'El mes ya tiene asistencia registrada; el plan no puede modificarse',
      },
    }, 409);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = crearPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  // Verifica que las fechas del plan correspondan al mes indicado
  const lineasFueraDelMes = parsed.data.lineas.filter((l) => !l.fecha.startsWith(yyyymm));
  if (lineasFueraDelMes.length > 0) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Hay ${lineasFueraDelMes.length} línea(s) fuera del mes ${yyyymm}`,
      },
    }, 400);
  }

  const user = c.get('user');
  const plazas = await getPlazas(c.env.DB);
  const plazasActivas = plazas.filter((p) => p.persona_id !== null);

  // Valida cobertura completa antes de persistir
  const validacion = validarPlanCompleto(parsed.data.lineas as Parameters<typeof validarPlanCompleto>[0], plazasActivas, yyyymm);
  if (!validacion.valido) {
    return c.json({
      error: {
        code: 'PLAN_INCOMPLETO',
        message: 'El plan no cubre todas las plazas activas',
        details: validacion.errores,
      },
    }, 409);
  }

  // Inserta / actualiza líneas
  for (const linea of parsed.data.lineas) {
    await withAudit(c.env.DB, user.email, 'plan_mensual', linea.persona_id, 'INSERT', null, async () => {
      return upsertPlanMensual(c.env.DB, {
        ...linea,
        estado_plan: 'borrador',
        creado_por: user.email,
        aprobado_por: null,
        aprobado_en: null,
      });
    });
  }

  return c.json({ data: { mensaje: `Plan ${yyyymm} guardado con ${parsed.data.lineas.length} líneas` } }, 201);
});

// POST /plan/:yyyymm/aprobar — aprueba el plan del mes
plan.post('/:yyyymm/aprobar', adminOJefatura, async (c) => {
  const yyyymm = c.req.param('yyyymm');
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM' } }, 400);
  }

  const lineas = await getPlanMensual(c.env.DB, yyyymm);
  if (lineas.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No hay plan para este mes' } }, 404);
  }

  const user = c.get('user');
  await aprobarPlanMensual(c.env.DB, yyyymm, user.email);

  return c.json({ data: { mensaje: `Plan ${yyyymm} aprobado` } });
});

// GET /plan/:yyyymm/deficit — análisis de déficit del mes
plan.get('/:yyyymm/deficit', todosLosRoles, async (c) => {
  const yyyymm = c.req.param('yyyymm');
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Formato: YYYY-MM' } }, 400);
  }

  const [year, month] = yyyymm.split('-').map(Number);
  if (!year || !month) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Mes inválido' } }, 400);

  const diasDelMes = new Date(year, month, 0).getDate();
  const lineas = await getPlanMensual(c.env.DB, yyyymm);
  const cobertura = await getCoberturaVigente(c.env.DB);

  const reportes = [];
  for (let d = 1; d <= diasDelMes; d++) {
    const fecha = `${yyyymm}-${String(d).padStart(2, '0')}`;
    reportes.push(calcularDeficit(lineas, cobertura, fecha));
  }

  return c.json({ data: reportes });
});

export default plan;
