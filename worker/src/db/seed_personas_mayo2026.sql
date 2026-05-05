-- =============================================================
-- Carga inicial de personal — Mayo 2026
-- Fuente: Planes de Trabajo CENTRO MÉDICO + HOSPITAL ESPECIALIZADO AVANTE
-- Ejecutar: npx wrangler d1 execute scp-prod --file=worker/src/db/seed_personas_mayo2026.sql
-- =============================================================

-- -----------------------------------------------
-- PERSONAS
-- -----------------------------------------------

INSERT OR IGNORE INTO persona (codigo_empleado, nombre, area, subarea, fecha_ingreso, estado, tipo_contrato) VALUES

-- CENTRO MÉDICO — Hospitalización (Limpieza)
('SG-001', 'CARMEN ANDREA CHAVARRIA',          'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-002', 'IVETTE EUNICE HUEZO',               'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-003', 'ANA CRISTELA MARTINEZ',             'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-004', 'JESSICA BENAVIDES',                 'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-005', 'MARIA MERCEDES FUNES OSORTO',       'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-006', 'DANIELA MARISOL GRANDE',            'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-007', 'JHOANA LISSETH FRANCO DE FRANCO',   'Centro Médico - Hospitalización', 'limpieza',         '2026-01-01', 'activo', 'permanente'),

-- CENTRO MÉDICO — Lavandería y Costurería
('SG-008', 'SONIA ELIZABETH PEREZ',             'Centro Médico - Lavandería',      'lavanderia',       '2026-01-01', 'activo', 'permanente'),
('SG-009', 'MIRNA JAZMIN GIRÓN',                'Centro Médico - Lavandería',      'lavanderia',       '2026-01-01', 'activo', 'permanente'),
('SG-010', 'MARIA MIRNA MENDOZA',               'Centro Médico - Lavandería',      'lavanderia',       '2026-01-01', 'activo', 'permanente'),

-- CENTRO MÉDICO — Sala de Operaciones
('SG-011', 'SONIA ELIZABETH LOBO',              'Centro Médico - Sala Operaciones','areas_comunes',    '2026-01-01', 'activo', 'permanente'),
('SG-012', 'DORA EVELIN CRUZ',                  'Centro Médico - Sala Operaciones','areas_comunes',    '2026-01-01', 'activo', 'permanente'),
('SG-013', 'GUADALUPE GONZALEZ',                'Centro Médico - Sala Operaciones','areas_comunes',    '2026-01-01', 'activo', 'permanente'),

-- CENTRO MÉDICO — Apoyo Limpieza Administrativa y Encamados
('SG-014', 'STACY AZUCENA GOMEZ MEJIA',         'Centro Médico - Apoyo Limpieza',  'limpieza',         '2026-01-01', 'activo', 'permanente'),
('SG-015', 'MARTA SILVESTRE',                   'Centro Médico - Apoyo Limpieza',  'limpieza',         '2026-01-01', 'activo', 'permanente'),

-- CENTRO MÉDICO — Programa Dr. SV (Apoyo Logístico)
('SG-016', 'DORA ALICIA HERNANDEZ',             'Centro Médico - Programa Dr. SV', 'apoyo_logistico',  '2026-01-01', 'activo', 'permanente'),
('SG-017', 'GERARDO ALEJANDRO LOPEZ',           'Centro Médico - Programa Dr. SV', 'apoyo_logistico',  '2026-01-01', 'activo', 'permanente'),
('SG-018', 'MIRIAN HERNANDEZ',                  'Centro Médico - Programa Dr. SV', 'apoyo_logistico',  '2026-01-01', 'activo', 'permanente'),
('SG-019', 'RENE HERNANDEZ',                    'Centro Médico - Programa Dr. SV', 'apoyo_logistico',  '2026-01-01', 'activo', 'permanente'),
('SG-020', 'JOSSELINE MARIZZA',                 'Centro Médico - Programa Dr. SV', 'apoyo_logistico',  '2026-01-01', 'activo', 'permanente'),

-- CENTRO MÉDICO — Clínicas
('SG-021', 'DEYSI MIRANDA',                     'Centro Médico - Clínicas',        'areas_comunes',    '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Emergencia-UCI
('SG-022', 'RUTH ABIGAIL FLORES',               'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-023', 'BRYAN ERNESTO ESCOBAR',             'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-024', 'BERIA MARIEL RODRIGUEZ BARAHONA',   'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-025', 'VILMA GUADALUPE ALVARADO PINEDA',   'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-026', 'VERONICA JEANNETTE',                'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-027', 'JOSMIRA RAQUEL RODRIGUEZ',          'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-035', 'DIXI ALEXANDER ALVARENGA',          'Hospital Especializado - Emergencia UCI', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Primer Nivel
('SG-028', 'SINDIA ALICEX AGUILAR',             'Hospital Especializado - Primer Nivel',  'limpieza',        '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Tercer Nivel
('SG-029', 'SANDRA NUÑEZ',                      'Hospital Especializado - Tercer Nivel',  'areas_comunes',   '2026-01-01', 'activo', 'permanente'),
('SG-030', 'KARLA MARROQUIN',                   'Hospital Especializado - Tercer Nivel',  'areas_comunes',   '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Sala de Operaciones
('SG-031', 'JOSE NARCISO GARCIA',               'Hospital Especializado - Sala Operaciones', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),
('SG-032', 'CARMEN PALACIOS',                   'Hospital Especializado - Sala Operaciones', 'areas_comunes', '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Cuarto Nivel
('SG-033', 'NOEMI ZELADA',                      'Hospital Especializado - Cuarto Nivel',  'areas_comunes',   '2026-01-01', 'activo', 'permanente'),
('SG-034', 'VERÓNICA RAMIREZ',                  'Hospital Especializado - Cuarto Nivel',  'areas_comunes',   '2026-01-01', 'activo', 'permanente'),

-- HOSPITAL ESPECIALIZADO AVANTE — Apoyo a Diferentes Áreas
('SG-036', 'DANIELA NAOMI RIVAS RIVAS',         'Hospital Especializado - Apoyo',         'apoyo_logistico', '2026-01-01', 'activo', 'permanente'),

-- CENTRO ESPECIALIZADO — Apoyo
('SG-037', 'GUADALUPE GONZALEZ FLORES',         'Centro Especializado - Apoyo',           'apoyo_logistico', '2026-01-01', 'activo', 'permanente');

-- -----------------------------------------------
-- PLAZAS (una por colaborador, estado contratada)
-- -----------------------------------------------

INSERT OR IGNORE INTO plaza (codigo_plaza, subarea, turno_base, estado, persona_id) VALUES
('PLZ-001', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-001')),
('PLZ-002', 'limpieza',        'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-002')),
('PLZ-003', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-003')),
('PLZ-004', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-004')),
('PLZ-005', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-005')),
('PLZ-006', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-006')),
('PLZ-007', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-007')),
('PLZ-008', 'lavanderia',      'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-008')),
('PLZ-009', 'lavanderia',      'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-009')),
('PLZ-010', 'lavanderia',      'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-010')),
('PLZ-011', 'areas_comunes',   'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-011')),
('PLZ-012', 'areas_comunes',   'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-012')),
('PLZ-013', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-013')),
('PLZ-014', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-014')),
('PLZ-015', 'limpieza',        'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-015')),
('PLZ-016', 'apoyo_logistico', 'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-016')),
('PLZ-017', 'apoyo_logistico', 'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-017')),
('PLZ-018', 'apoyo_logistico', 'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-018')),
('PLZ-019', 'apoyo_logistico', 'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-019')),
('PLZ-020', 'apoyo_logistico', 'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-020')),
('PLZ-021', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-021')),
('PLZ-022', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-022')),
('PLZ-023', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-023')),
('PLZ-024', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-024')),
('PLZ-025', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-025')),
('PLZ-026', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-026')),
('PLZ-027', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-027')),
('PLZ-028', 'limpieza',        'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-028')),
('PLZ-029', 'areas_comunes',   'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-029')),
('PLZ-030', 'areas_comunes',   'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-030')),
('PLZ-031', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-031')),
('PLZ-032', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-032')),
('PLZ-033', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-033')),
('PLZ-034', 'areas_comunes',   'N', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-034')),
('PLZ-035', 'areas_comunes',   'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-035')),
('PLZ-036', 'apoyo_logistico', 'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-036')),
('PLZ-037', 'apoyo_logistico', 'D', 'contratada', (SELECT id FROM persona WHERE codigo_empleado = 'SG-037'));
