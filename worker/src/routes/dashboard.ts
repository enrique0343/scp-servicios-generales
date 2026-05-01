import { Hono } from 'hono';
import type { AppEnv, AuthUser, KpiDashboard } from '../types';
import { todosLosRoles } from '../middleware/rbac';
import { resumirHorasExtra } from '../domain/horasExtra';

type Variables = { user: AuthUser };

const dashboard = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

function validarRango(desde: string | undefined, hasta: string | undefined) {
  const hoy = new Date().toISOString().slice(0, 10);
  const d = desde ?? new Date().toISOString().slice(0, 7) + '-01';
  const h = hasta ?? hoy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) {
    return null;
  }
  return { desde: d, hasta: h };
}

// GET /dashboard/kpis?desde&hasta&subarea
dashboard.get('/kpis', todosLosRoles, async (c) => {
  const rango = validarRango(c.req.query('desde'), c.req.query('hasta'));
  if (!rango) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Fechas inválidas. Usar YYYY-MM-DD' } }, 400);

  const subarea = c.req.query('subarea');

  // Consultas SQL agregadas para KPIs
  const subareaFilter = subarea ? ` AND subarea_asignada = '${subarea}'` : '';

  // Cumplimiento de cobertura: presentes / planificadas (excluyendo descansos)
  const coberturaRow = await c.env.DB.prepare(
    `SELECT
       COUNT(CASE WHEN estado = 'presente' THEN 1 END) * 1.0 /
       NULLIF(COUNT(CASE WHEN turno_planificado != 'descanso' THEN 1 END), 0) AS cumplimiento
     FROM asistencia_diaria
     WHERE fecha BETWEEN ? AND ?${subareaFilter}`
  ).bind(rango.desde, rango.hasta).first<{ cumplimiento: number | null }>();

  // Tasa ausentismo: injustificadas / planificadas
  const ausentismoRow = await c.env.DB.prepare(
    `SELECT
       COUNT(CASE WHEN estado = 'ausente_injustificado' THEN 1 END) * 1.0 /
       NULLIF(COUNT(CASE WHEN turno_planificado != 'descanso' THEN 1 END), 0) AS tasa
     FROM asistencia_diaria
     WHERE fecha BETWEEN ? AND ?`
  ).bind(rango.desde, rango.hasta).first<{ tasa: number | null }>();

  // HE por fallo de cobertura
  const heRows = await c.env.DB.prepare(
    `SELECT * FROM excepcion WHERE fecha BETWEEN ? AND ? AND horas_extra_generadas > 0`
  ).bind(rango.desde, rango.hasta).all();
  const heResumen = resumirHorasExtra(heRows.results as unknown as Parameters<typeof resumirHorasExtra>[0]);

  // Rotación: bajas del periodo / promedio plantilla
  const rotacionRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as bajas FROM persona WHERE fecha_baja BETWEEN ? AND ?`
  ).bind(rango.desde, rango.hasta).first<{ bajas: number }>();

  const plantillaRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as activos FROM persona WHERE estado = 'activo'`
  ).first<{ activos: number }>();

  // Brecha estructural: autorizadas - contratadas activas
  const brechaRow = await c.env.DB.prepare(
    `SELECT
       COUNT(CASE WHEN estado = 'autorizada' THEN 1 END) as autorizadas,
       COUNT(CASE WHEN estado = 'contratada' THEN 1 END) as contratadas
     FROM plaza`
  ).first<{ autorizadas: number; contratadas: number }>();

  const kpis: KpiDashboard = {
    cumplimiento_cobertura: Math.round((coberturaRow?.cumplimiento ?? 0) * 100 * 100) / 100,
    tasa_ausentismo: Math.round((ausentismoRow?.tasa ?? 0) * 100 * 100) / 100,
    he_por_fallo_cobertura: Math.round(heResumen.porcentaje_fallo * 100) / 100,
    rotacion_mensual: plantillaRow?.activos
      ? Math.round(((rotacionRow?.bajas ?? 0) / plantillaRow.activos) * 100 * 100) / 100
      : 0,
    brecha_estructural: (brechaRow?.autorizadas ?? 0) - (brechaRow?.contratadas ?? 0),
  };

  return c.json({ data: kpis });
});

// GET /dashboard/serie-cobertura?desde&hasta
dashboard.get('/serie-cobertura', todosLosRoles, async (c) => {
  const rango = validarRango(c.req.query('desde'), c.req.query('hasta'));
  if (!rango) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Fechas inválidas' } }, 400);

  const result = await c.env.DB.prepare(
    `SELECT
       fecha,
       COUNT(CASE WHEN estado = 'presente' THEN 1 END) as presentes,
       COUNT(CASE WHEN turno_planificado != 'descanso' THEN 1 END) as planificadas
     FROM asistencia_diaria
     WHERE fecha BETWEEN ? AND ?
     GROUP BY fecha
     ORDER BY fecha`
  ).bind(rango.desde, rango.hasta).all();

  return c.json({ data: result.results });
});

// GET /dashboard/distribucion-ausencias?desde&hasta
dashboard.get('/distribucion-ausencias', todosLosRoles, async (c) => {
  const rango = validarRango(c.req.query('desde'), c.req.query('hasta'));
  if (!rango) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Fechas inválidas' } }, 400);

  const result = await c.env.DB.prepare(
    `SELECT motivo_categoria, COUNT(*) as total
     FROM excepcion
     WHERE fecha BETWEEN ? AND ? AND tipo = 'ausencia'
     GROUP BY motivo_categoria
     ORDER BY total DESC`
  ).bind(rango.desde, rango.hasta).all();

  return c.json({ data: result.results });
});

// GET /dashboard/he-clasificada?desde&hasta
dashboard.get('/he-clasificada', todosLosRoles, async (c) => {
  const rango = validarRango(c.req.query('desde'), c.req.query('hasta'));
  if (!rango) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Fechas inválidas' } }, 400);

  const result = await c.env.DB.prepare(
    `SELECT
       strftime('%Y-%m', fecha) as mes,
       clasificacion_he,
       SUM(horas_extra_generadas) as total_horas
     FROM excepcion
     WHERE fecha BETWEEN ? AND ? AND horas_extra_generadas > 0
     GROUP BY mes, clasificacion_he
     ORDER BY mes`
  ).bind(rango.desde, rango.hasta).all();

  return c.json({ data: result.results });
});

// GET /dashboard/export?desde&hasta — exportación de datos (XLSX requiere librería adicional en V2)
dashboard.get('/export', todosLosRoles, async (c) => {
  const rango = validarRango(c.req.query('desde'), c.req.query('hasta'));
  if (!rango) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Fechas inválidas' } }, 400);

  const asistencias = await c.env.DB.prepare(
    `SELECT ad.*, p.nombre, p.subarea
     FROM asistencia_diaria ad
     JOIN persona p ON ad.persona_id = p.id
     WHERE ad.fecha BETWEEN ? AND ?
     ORDER BY ad.fecha, p.nombre`
  ).bind(rango.desde, rango.hasta).all();

  // V1: retorna JSON. V2: integrar SheetJS para generar XLSX.
  return c.json({ data: asistencias.results });
});

export default dashboard;
