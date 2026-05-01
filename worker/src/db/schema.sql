-- =============================================================
-- SCP Servicios Generales — DDL completo
-- Código: GO-PRY-002-2026
-- =============================================================

-- =============================================================
-- 1. PLAZA (puesto autorizado, independiente de la persona)
-- =============================================================
CREATE TABLE IF NOT EXISTS plaza (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_plaza TEXT NOT NULL UNIQUE,
  subarea TEXT NOT NULL CHECK (subarea IN ('limpieza','jardineria','lavanderia','apoyo_logistico','areas_comunes')),
  turno_base TEXT NOT NULL CHECK (turno_base IN ('D','N')),
  estado TEXT NOT NULL DEFAULT 'autorizada' CHECK (estado IN ('autorizada','contratada','vacante')),
  persona_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (persona_id) REFERENCES persona(id)
);

-- =============================================================
-- 2. PERSONA (recurso humano contratado)
-- =============================================================
CREATE TABLE IF NOT EXISTS persona (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_empleado TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'servicios_generales',
  subarea TEXT NOT NULL CHECK (subarea IN ('limpieza','jardineria','lavanderia','apoyo_logistico','areas_comunes')),
  fecha_ingreso TEXT NOT NULL,
  fecha_baja TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','suspendido')),
  tipo_contrato TEXT NOT NULL DEFAULT 'permanente' CHECK (tipo_contrato IN ('permanente','temporal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================
-- 3. PLAN_MENSUAL (calendario planificado)
-- =============================================================
CREATE TABLE IF NOT EXISTS plan_mensual (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('D','N','descanso')),
  subarea_asignada TEXT NOT NULL CHECK (subarea_asignada IN ('limpieza','jardineria','lavanderia','apoyo_logistico','areas_comunes')),
  estado_plan TEXT NOT NULL DEFAULT 'borrador' CHECK (estado_plan IN ('borrador','aprobado')),
  creado_por TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  aprobado_por TEXT,
  aprobado_en TEXT,
  FOREIGN KEY (persona_id) REFERENCES persona(id),
  UNIQUE (persona_id, fecha)
);

-- =============================================================
-- 4. ASISTENCIA_DIARIA (snapshot real)
-- =============================================================
CREATE TABLE IF NOT EXISTS asistencia_diaria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  turno_planificado TEXT NOT NULL CHECK (turno_planificado IN ('D','N','descanso')),
  turno_real TEXT NOT NULL CHECK (turno_real IN ('D','N','descanso','doble')),
  estado TEXT NOT NULL CHECK (estado IN ('presente','ausente_justificado','ausente_injustificado','sustitucion','doble_turno','permiso','incapacidad','vacaciones')),
  hora_entrada TEXT,
  hora_salida TEXT,
  horas_trabajadas REAL DEFAULT 0,
  registrado_por TEXT NOT NULL,
  registrado_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrado INTEGER NOT NULL DEFAULT 0 CHECK (cerrado IN (0,1)),
  cerrado_por TEXT,
  cerrado_en TEXT,
  FOREIGN KEY (persona_id) REFERENCES persona(id),
  UNIQUE (persona_id, fecha)
);

-- =============================================================
-- 5. EXCEPCION (toda desviación del plan)
-- =============================================================
CREATE TABLE IF NOT EXISTS excepcion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  persona_afectada_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ausencia','sustitucion','doble_turno','cambio_area','cambio_turno')),
  motivo_categoria TEXT NOT NULL CHECK (motivo_categoria IN ('enfermedad','permiso_personal','falta_relevo','emergencia_operativa','vacaciones','otro')),
  motivo_detalle TEXT CHECK (length(motivo_detalle) <= 200),
  persona_sustituta_id INTEGER,
  horas_extra_generadas REAL DEFAULT 0,
  clasificacion_he TEXT CHECK (clasificacion_he IN ('planificada','por_fallo_cobertura','por_demanda') OR clasificacion_he IS NULL),
  autorizado_por TEXT NOT NULL,
  autorizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (persona_afectada_id) REFERENCES persona(id),
  FOREIGN KEY (persona_sustituta_id) REFERENCES persona(id)
);

-- =============================================================
-- 6. COBERTURA_ESTANDAR (regla de cobertura mínima)
-- =============================================================
CREATE TABLE IF NOT EXISTS cobertura_estandar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subarea TEXT NOT NULL CHECK (subarea IN ('limpieza','jardineria','lavanderia','apoyo_logistico','areas_comunes')),
  turno TEXT NOT NULL CHECK (turno IN ('D','N')),
  dia_tipo TEXT NOT NULL CHECK (dia_tipo IN ('laboral','sabado','domingo','feriado')),
  personas_minimas INTEGER NOT NULL CHECK (personas_minimas > 0),
  vigencia_desde TEXT NOT NULL,
  vigencia_hasta TEXT,
  aprobado_por TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================
-- 7. USUARIO (cuentas del sistema)
-- =============================================================
CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','jefatura','supervisor','lectura')),
  persona_vinculada_id INTEGER,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  ultimo_acceso TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (persona_vinculada_id) REFERENCES persona(id)
);

-- =============================================================
-- BITÁCORA DE AUDITORÍA (requisito JCI MOI)
-- =============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tabla TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  usuario_email TEXT NOT NULL,
  payload_anterior TEXT,
  payload_nuevo TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================
-- ÍNDICES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia_diaria(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_persona ON asistencia_diaria(persona_id);
CREATE INDEX IF NOT EXISTS idx_excepcion_fecha ON excepcion(fecha);
CREATE INDEX IF NOT EXISTS idx_plan_fecha ON plan_mensual(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_plaza_subarea ON plaza(subarea);
CREATE INDEX IF NOT EXISTS idx_persona_estado ON persona(estado);
