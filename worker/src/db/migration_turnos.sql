-- =============================================================
-- Migración: catálogo de turnos configurables
-- Ejecutar: npx wrangler@4 d1 execute scp-prod --remote --file=src/db/migration_turnos.sql
-- =============================================================

-- 1. Tabla de configuración de turnos
CREATE TABLE IF NOT EXISTS turno_config (
  codigo         TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  hora_inicio    TEXT NOT NULL,
  hora_fin       TEXT NOT NULL,
  horas_duracion REAL NOT NULL,
  cruza_medianoche INTEGER NOT NULL DEFAULT 0 CHECK (cruza_medianoche IN (0,1)),
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Turnos iniciales
INSERT OR IGNORE INTO turno_config (codigo, nombre, hora_inicio, hora_fin, horas_duracion, cruza_medianoche) VALUES
  ('D',  'Diurno 12h',           '06:00', '18:00', 12, 0),
  ('N',  'Nocturno 12h',         '18:00', '06:00', 12, 1),
  ('8A', 'Diurno 8h (08-16)',    '08:00', '16:00',  8, 0),
  ('8B', 'Diurno 8h (06-14)',    '06:00', '14:00',  8, 0),
  ('24', 'Turno 24h',            '06:00', '06:00', 24, 1);

-- 3. Recrear plan_mensual sin CHECK constraint en turno
--    (SQLite no soporta DROP CONSTRAINT; hay que recrear la tabla)
CREATE TABLE IF NOT EXISTS plan_mensual_v2 (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id      INTEGER NOT NULL,
  fecha           TEXT NOT NULL,
  turno           TEXT NOT NULL,
  subarea_asignada TEXT NOT NULL CHECK (subarea_asignada IN ('limpieza','jardineria','lavanderia','apoyo_logistico','areas_comunes')),
  estado_plan     TEXT NOT NULL DEFAULT 'borrador' CHECK (estado_plan IN ('borrador','aprobado')),
  creado_por      TEXT NOT NULL,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  aprobado_por    TEXT,
  aprobado_en     TEXT,
  FOREIGN KEY (persona_id) REFERENCES persona(id),
  UNIQUE (persona_id, fecha)
);

INSERT INTO plan_mensual_v2
  SELECT id, persona_id, fecha, turno, subarea_asignada,
         estado_plan, creado_por, creado_en, aprobado_por, aprobado_en
  FROM plan_mensual;

DROP TABLE plan_mensual;
ALTER TABLE plan_mensual_v2 RENAME TO plan_mensual;
CREATE INDEX IF NOT EXISTS idx_plan_fecha ON plan_mensual(fecha);

-- 4. Recrear asistencia_diaria sin CHECK constraints en turno_planificado / turno_real
CREATE TABLE IF NOT EXISTS asistencia_diaria_v2 (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id        INTEGER NOT NULL,
  fecha             TEXT NOT NULL,
  turno_planificado TEXT NOT NULL,
  turno_real        TEXT NOT NULL,
  estado            TEXT NOT NULL CHECK (estado IN ('presente','ausente_justificado','ausente_injustificado','sustitucion','doble_turno','permiso','incapacidad','vacaciones')),
  hora_entrada      TEXT,
  hora_salida       TEXT,
  horas_trabajadas  REAL DEFAULT 0,
  registrado_por    TEXT NOT NULL,
  registrado_en     TEXT NOT NULL DEFAULT (datetime('now')),
  cerrado           INTEGER NOT NULL DEFAULT 0 CHECK (cerrado IN (0,1)),
  cerrado_por       TEXT,
  cerrado_en        TEXT,
  FOREIGN KEY (persona_id) REFERENCES persona(id),
  UNIQUE (persona_id, fecha)
);

INSERT INTO asistencia_diaria_v2
  SELECT id, persona_id, fecha, turno_planificado, turno_real,
         estado, hora_entrada, hora_salida, horas_trabajadas,
         registrado_por, registrado_en, cerrado, cerrado_por, cerrado_en
  FROM asistencia_diaria;

DROP TABLE asistencia_diaria;
ALTER TABLE asistencia_diaria_v2 RENAME TO asistencia_diaria;
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha     ON asistencia_diaria(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_persona   ON asistencia_diaria(persona_id);
