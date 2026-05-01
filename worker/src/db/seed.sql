-- =============================================================
-- SEED — SCP Servicios Generales
-- 37 plazas autorizadas + cobertura estándar + usuarios iniciales
-- Pendiente de actualizar con datos reales del Product Owner
-- =============================================================

-- =============================================================
-- PLAZAS (37 autorizadas modelo Panamá 12×12)
-- Distribución por subárea (placeholder — actualizar con Licda. Arely Montaño):
--   limpieza:        16 plazas (8D, 8N)
--   areas_comunes:    8 plazas (4D, 4N)
--   apoyo_logistico:  6 plazas (3D, 3N)
--   lavanderia:       4 plazas (2D, 2N)
--   jardineria:       3 plazas (3D)
-- =============================================================

INSERT OR IGNORE INTO plaza (codigo_plaza, subarea, turno_base, estado) VALUES
-- limpieza
('SG-001','limpieza','D','autorizada'),
('SG-002','limpieza','D','autorizada'),
('SG-003','limpieza','D','autorizada'),
('SG-004','limpieza','D','autorizada'),
('SG-005','limpieza','D','autorizada'),
('SG-006','limpieza','D','autorizada'),
('SG-007','limpieza','D','autorizada'),
('SG-008','limpieza','D','autorizada'),
('SG-009','limpieza','N','autorizada'),
('SG-010','limpieza','N','autorizada'),
('SG-011','limpieza','N','autorizada'),
('SG-012','limpieza','N','autorizada'),
('SG-013','limpieza','N','autorizada'),
('SG-014','limpieza','N','autorizada'),
('SG-015','limpieza','N','autorizada'),
('SG-016','limpieza','N','autorizada'),
-- areas_comunes
('SG-017','areas_comunes','D','autorizada'),
('SG-018','areas_comunes','D','autorizada'),
('SG-019','areas_comunes','D','autorizada'),
('SG-020','areas_comunes','D','autorizada'),
('SG-021','areas_comunes','N','autorizada'),
('SG-022','areas_comunes','N','autorizada'),
('SG-023','areas_comunes','N','autorizada'),
('SG-024','areas_comunes','N','autorizada'),
-- apoyo_logistico
('SG-025','apoyo_logistico','D','autorizada'),
('SG-026','apoyo_logistico','D','autorizada'),
('SG-027','apoyo_logistico','D','autorizada'),
('SG-028','apoyo_logistico','N','autorizada'),
('SG-029','apoyo_logistico','N','autorizada'),
('SG-030','apoyo_logistico','N','autorizada'),
-- lavanderia
('SG-031','lavanderia','D','autorizada'),
('SG-032','lavanderia','D','autorizada'),
('SG-033','lavanderia','N','autorizada'),
('SG-034','lavanderia','N','autorizada'),
-- jardineria (solo turno diurno)
('SG-035','jardineria','D','autorizada'),
('SG-036','jardineria','D','autorizada'),
('SG-037','jardineria','D','autorizada');

-- =============================================================
-- COBERTURA ESTÁNDAR (referencia Lean Avante — actualizar con tabla firmada)
-- =============================================================

INSERT OR IGNORE INTO cobertura_estandar (subarea, turno, dia_tipo, personas_minimas, vigencia_desde, aprobado_por) VALUES
-- limpieza
('limpieza','D','laboral',6,'2026-01-01','Licda. Arely Montaño'),
('limpieza','D','sabado',5,'2026-01-01','Licda. Arely Montaño'),
('limpieza','D','domingo',4,'2026-01-01','Licda. Arely Montaño'),
('limpieza','D','feriado',4,'2026-01-01','Licda. Arely Montaño'),
('limpieza','N','laboral',5,'2026-01-01','Licda. Arely Montaño'),
('limpieza','N','sabado',4,'2026-01-01','Licda. Arely Montaño'),
('limpieza','N','domingo',4,'2026-01-01','Licda. Arely Montaño'),
('limpieza','N','feriado',3,'2026-01-01','Licda. Arely Montaño'),
-- areas_comunes
('areas_comunes','D','laboral',3,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','D','sabado',2,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','D','domingo',2,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','D','feriado',2,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','N','laboral',2,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','N','sabado',2,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','N','domingo',1,'2026-01-01','Licda. Arely Montaño'),
('areas_comunes','N','feriado',1,'2026-01-01','Licda. Arely Montaño'),
-- apoyo_logistico
('apoyo_logistico','D','laboral',2,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','D','sabado',1,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','D','domingo',1,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','D','feriado',1,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','N','laboral',2,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','N','sabado',1,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','N','domingo',1,'2026-01-01','Licda. Arely Montaño'),
('apoyo_logistico','N','feriado',1,'2026-01-01','Licda. Arely Montaño'),
-- lavanderia
('lavanderia','D','laboral',2,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','D','sabado',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','D','domingo',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','D','feriado',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','N','laboral',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','N','sabado',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','N','domingo',1,'2026-01-01','Licda. Arely Montaño'),
('lavanderia','N','feriado',1,'2026-01-01','Licda. Arely Montaño'),
-- jardineria (solo diurno)
('jardineria','D','laboral',2,'2026-01-01','Licda. Arely Montaño'),
('jardineria','D','sabado',1,'2026-01-01','Licda. Arely Montaño'),
('jardineria','D','domingo',0,'2026-01-01','Licda. Arely Montaño'),
('jardineria','D','feriado',0,'2026-01-01','Licda. Arely Montaño');

-- =============================================================
-- USUARIOS INICIALES
-- =============================================================

INSERT OR IGNORE INTO usuario (email, nombre, rol) VALUES
('enrique0343@gmail.com', 'Lic. Abraham Medina', 'admin'),
('arely.montano@avante.com.sv', 'Licda. Arely Montaño', 'jefatura'),
('supervisor@avante.com.sv', 'Supervisor Designado', 'supervisor'),
('comite.gerencial@avante.com.sv', 'Comite Gerencial', 'lectura');
