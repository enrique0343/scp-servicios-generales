import type {
  Plaza,
  Persona,
  PlanMensual,
  AsistenciaDiaria,
  Excepcion,
  CoberturaEstandar,
  Usuario,
  Auditoria,
  AccionAuditoria,
} from '../types';

// =============================================================
// Plazas
// =============================================================

export async function getPlazas(db: D1Database): Promise<Plaza[]> {
  const result = await db.prepare('SELECT * FROM plaza ORDER BY codigo_plaza').all<Plaza>();
  return result.results;
}

export async function getPlazaById(db: D1Database, id: number): Promise<Plaza | null> {
  return db.prepare('SELECT * FROM plaza WHERE id = ?').bind(id).first<Plaza>();
}

export async function createPlaza(
  db: D1Database,
  data: Omit<Plaza, 'id' | 'created_at' | 'updated_at'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO plaza (codigo_plaza, subarea, turno_base, estado, persona_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(data.codigo_plaza, data.subarea, data.turno_base, data.estado, data.persona_id)
    .run();
}

export async function updatePlaza(
  db: D1Database,
  id: number,
  data: Partial<Omit<Plaza, 'id' | 'created_at' | 'updated_at'>>
): Promise<D1Result> {
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = [...Object.values(data), new Date().toISOString(), id];
  return db
    .prepare(`UPDATE plaza SET ${fields}, updated_at = ? WHERE id = ?`)
    .bind(...values)
    .run();
}

// =============================================================
// Personas
// =============================================================

export async function getPersonas(db: D1Database): Promise<Persona[]> {
  const result = await db
    .prepare('SELECT * FROM persona WHERE estado = ? ORDER BY nombre')
    .bind('activo')
    .all<Persona>();
  return result.results;
}

export async function getPersonaById(db: D1Database, id: number): Promise<Persona | null> {
  return db.prepare('SELECT * FROM persona WHERE id = ?').bind(id).first<Persona>();
}

export async function createPersona(
  db: D1Database,
  data: Omit<Persona, 'id' | 'created_at' | 'updated_at'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO persona (codigo_empleado, nombre, area, subarea, fecha_ingreso, fecha_baja, estado, tipo_contrato)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.codigo_empleado,
      data.nombre,
      data.area,
      data.subarea,
      data.fecha_ingreso,
      data.fecha_baja,
      data.estado,
      data.tipo_contrato
    )
    .run();
}

export async function updatePersona(
  db: D1Database,
  id: number,
  data: Partial<Omit<Persona, 'id' | 'created_at' | 'updated_at'>>
): Promise<D1Result> {
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = [...Object.values(data), new Date().toISOString(), id];
  return db
    .prepare(`UPDATE persona SET ${fields}, updated_at = ? WHERE id = ?`)
    .bind(...values)
    .run();
}

// =============================================================
// Plan mensual
// =============================================================

export async function getPlanMensual(
  db: D1Database,
  yyyymm: string
): Promise<PlanMensual[]> {
  const result = await db
    .prepare(
      `SELECT * FROM plan_mensual
       WHERE fecha LIKE ? ORDER BY fecha, persona_id`
    )
    .bind(`${yyyymm}%`)
    .all<PlanMensual>();
  return result.results;
}

export async function getPlanByPersonaFecha(
  db: D1Database,
  persona_id: number,
  fecha: string
): Promise<PlanMensual | null> {
  return db
    .prepare('SELECT * FROM plan_mensual WHERE persona_id = ? AND fecha = ?')
    .bind(persona_id, fecha)
    .first<PlanMensual>();
}

export async function upsertPlanMensual(
  db: D1Database,
  data: Omit<PlanMensual, 'id' | 'creado_en'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO plan_mensual (persona_id, fecha, turno, subarea_asignada, estado_plan, creado_por, aprobado_por, aprobado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (persona_id, fecha) DO UPDATE SET
         turno = excluded.turno,
         subarea_asignada = excluded.subarea_asignada,
         estado_plan = excluded.estado_plan`
    )
    .bind(
      data.persona_id,
      data.fecha,
      data.turno,
      data.subarea_asignada,
      data.estado_plan,
      data.creado_por,
      data.aprobado_por,
      data.aprobado_en
    )
    .run();
}

export async function aprobarPlanMensual(
  db: D1Database,
  yyyymm: string,
  aprobado_por: string
): Promise<D1Result> {
  return db
    .prepare(
      `UPDATE plan_mensual SET estado_plan = 'aprobado', aprobado_por = ?, aprobado_en = datetime('now')
       WHERE fecha LIKE ? AND estado_plan = 'borrador'`
    )
    .bind(aprobado_por, `${yyyymm}%`)
    .run();
}

// Verifica si un mes tiene al menos un registro de asistencia (bloquea edición del plan)
export async function mestieneAsistencia(db: D1Database, yyyymm: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT COUNT(*) as cnt FROM asistencia_diaria WHERE fecha LIKE ?`)
    .bind(`${yyyymm}%`)
    .first<{ cnt: number }>();
  return (row?.cnt ?? 0) > 0;
}

// =============================================================
// Asistencia diaria
// =============================================================

export async function getAsistenciaByFecha(
  db: D1Database,
  fecha: string
): Promise<AsistenciaDiaria[]> {
  const result = await db
    .prepare('SELECT * FROM asistencia_diaria WHERE fecha = ? ORDER BY persona_id')
    .bind(fecha)
    .all<AsistenciaDiaria>();
  return result.results;
}

export async function upsertAsistencia(
  db: D1Database,
  data: Omit<AsistenciaDiaria, 'id' | 'registrado_en'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO asistencia_diaria
         (persona_id, fecha, turno_planificado, turno_real, estado, hora_entrada, hora_salida,
          horas_trabajadas, registrado_por, cerrado, cerrado_por, cerrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (persona_id, fecha) DO UPDATE SET
         turno_real = excluded.turno_real,
         estado = excluded.estado,
         hora_entrada = excluded.hora_entrada,
         hora_salida = excluded.hora_salida,
         horas_trabajadas = excluded.horas_trabajadas,
         registrado_por = excluded.registrado_por`
    )
    .bind(
      data.persona_id,
      data.fecha,
      data.turno_planificado,
      data.turno_real,
      data.estado,
      data.hora_entrada,
      data.hora_salida,
      data.horas_trabajadas,
      data.registrado_por,
      data.cerrado,
      data.cerrado_por,
      data.cerrado_en
    )
    .run();
}

export async function cerrarDia(
  db: D1Database,
  fecha: string,
  cerrado_por: string
): Promise<D1Result> {
  return db
    .prepare(
      `UPDATE asistencia_diaria SET cerrado = 1, cerrado_por = ?, cerrado_en = datetime('now')
       WHERE fecha = ? AND cerrado = 0`
    )
    .bind(cerrado_por, fecha)
    .run();
}

// =============================================================
// Excepciones
// =============================================================

export async function getExcepciones(
  db: D1Database,
  desde: string,
  hasta: string,
  tipo?: string
): Promise<Excepcion[]> {
  const query = tipo
    ? `SELECT * FROM excepcion WHERE fecha BETWEEN ? AND ? AND tipo = ? ORDER BY fecha`
    : `SELECT * FROM excepcion WHERE fecha BETWEEN ? AND ? ORDER BY fecha`;
  const stmt = tipo
    ? db.prepare(query).bind(desde, hasta, tipo)
    : db.prepare(query).bind(desde, hasta);
  const result = await stmt.all<Excepcion>();
  return result.results;
}

export async function createExcepcion(
  db: D1Database,
  data: Omit<Excepcion, 'id' | 'autorizado_en'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO excepcion
         (fecha, persona_afectada_id, tipo, motivo_categoria, motivo_detalle,
          persona_sustituta_id, horas_extra_generadas, clasificacion_he, autorizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.fecha,
      data.persona_afectada_id,
      data.tipo,
      data.motivo_categoria,
      data.motivo_detalle,
      data.persona_sustituta_id,
      data.horas_extra_generadas,
      data.clasificacion_he,
      data.autorizado_por
    )
    .run();
}

export async function getExcepcionesPendientesPorFecha(
  db: D1Database,
  fecha: string
): Promise<number> {
  // Ausencias sin excepción registrada ese día
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM asistencia_diaria ad
       WHERE ad.fecha = ? AND ad.estado IN ('ausente_injustificado','sustitucion','doble_turno')
         AND NOT EXISTS (
           SELECT 1 FROM excepcion e
           WHERE e.fecha = ad.fecha AND e.persona_afectada_id = ad.persona_id
         )`
    )
    .bind(fecha)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

// =============================================================
// Cobertura estándar
// =============================================================

export async function getCoberturaVigente(db: D1Database): Promise<CoberturaEstandar[]> {
  const result = await db
    .prepare(
      `SELECT * FROM cobertura_estandar
       WHERE vigencia_hasta IS NULL OR vigencia_hasta >= date('now')
       ORDER BY subarea, turno, dia_tipo`
    )
    .all<CoberturaEstandar>();
  return result.results;
}

// =============================================================
// Usuarios
// =============================================================

export async function getUsuarioByEmail(
  db: D1Database,
  email: string
): Promise<Usuario | null> {
  return db
    .prepare('SELECT * FROM usuario WHERE email = ? AND activo = 1')
    .bind(email)
    .first<Usuario>();
}

export async function createUsuario(
  db: D1Database,
  data: Omit<Usuario, 'id' | 'created_at' | 'ultimo_acceso'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO usuario (email, nombre, rol, persona_vinculada_id, activo)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(data.email, data.nombre, data.rol, data.persona_vinculada_id, data.activo)
    .run();
}

export async function updateUltimoAcceso(
  db: D1Database,
  email: string
): Promise<D1Result> {
  return db
    .prepare(`UPDATE usuario SET ultimo_acceso = datetime('now') WHERE email = ?`)
    .bind(email)
    .run();
}

// =============================================================
// Auditoría
// =============================================================

export async function insertAuditoria(
  db: D1Database,
  data: Omit<Auditoria, 'id' | 'timestamp'>
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO auditoria (tabla, registro_id, accion, usuario_email, payload_anterior, payload_nuevo)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.tabla,
      data.registro_id,
      data.accion,
      data.usuario_email,
      data.payload_anterior,
      data.payload_nuevo
    )
    .run();
}

export async function getAuditoriaByTablaRegistro(
  db: D1Database,
  tabla: string,
  registro_id: number
): Promise<Auditoria[]> {
  const result = await db
    .prepare(
      `SELECT * FROM auditoria WHERE tabla = ? AND registro_id = ? ORDER BY timestamp DESC`
    )
    .bind(tabla, registro_id)
    .all<Auditoria>();
  return result.results;
}

// Reexport para conveniencia
export type { AccionAuditoria };
