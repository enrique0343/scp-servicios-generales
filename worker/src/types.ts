// =============================================================
// Tipos compartidos del dominio SCP
// Único lugar donde se definen roles, entidades y contratos API
// =============================================================

export type Rol = 'admin' | 'jefatura' | 'supervisor' | 'lectura';

export type Subarea =
  | 'limpieza'
  | 'jardineria'
  | 'lavanderia'
  | 'apoyo_logistico'
  | 'areas_comunes';

export type TurnoBase = 'D' | 'N';
export type TurnoReal = 'D' | 'N' | 'descanso' | 'doble';
export type TurnoPlan = 'D' | 'N' | 'descanso';

export type EstadoPlaza = 'autorizada' | 'contratada' | 'vacante';
export type EstadoPersona = 'activo' | 'inactivo' | 'suspendido';
export type TipoContrato = 'permanente' | 'temporal';
export type EstadoPlan = 'borrador' | 'aprobado';

export type EstadoAsistencia =
  | 'presente'
  | 'ausente_justificado'
  | 'ausente_injustificado'
  | 'sustitucion'
  | 'doble_turno'
  | 'permiso'
  | 'incapacidad'
  | 'vacaciones';

export type TipoExcepcion =
  | 'ausencia'
  | 'sustitucion'
  | 'doble_turno'
  | 'cambio_area'
  | 'cambio_turno';

export type MotivoCategoria =
  | 'enfermedad'
  | 'permiso_personal'
  | 'falta_relevo'
  | 'emergencia_operativa'
  | 'vacaciones'
  | 'otro';

export type ClasificacionHE =
  | 'planificada'
  | 'por_fallo_cobertura'
  | 'por_demanda';

export type DiaTipo = 'laboral' | 'sabado' | 'domingo' | 'feriado';

export type AccionAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';

// =============================================================
// Entidades de base de datos
// =============================================================

export interface Plaza {
  id: number;
  codigo_plaza: string;
  subarea: Subarea;
  turno_base: TurnoBase;
  estado: EstadoPlaza;
  persona_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: number;
  codigo_empleado: string;
  nombre: string;
  area: string;
  subarea: Subarea;
  fecha_ingreso: string;
  fecha_baja: string | null;
  estado: EstadoPersona;
  tipo_contrato: TipoContrato;
  created_at: string;
  updated_at: string;
}

export interface PlanMensual {
  id: number;
  persona_id: number;
  fecha: string;
  turno: TurnoPlan;
  subarea_asignada: Subarea;
  estado_plan: EstadoPlan;
  creado_por: string;
  creado_en: string;
  aprobado_por: string | null;
  aprobado_en: string | null;
}

export interface AsistenciaDiaria {
  id: number;
  persona_id: number;
  fecha: string;
  turno_planificado: TurnoPlan;
  turno_real: TurnoReal;
  estado: EstadoAsistencia;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number;
  registrado_por: string;
  registrado_en: string;
  cerrado: 0 | 1;
  cerrado_por: string | null;
  cerrado_en: string | null;
}

export interface Excepcion {
  id: number;
  fecha: string;
  persona_afectada_id: number;
  tipo: TipoExcepcion;
  motivo_categoria: MotivoCategoria;
  motivo_detalle: string | null;
  persona_sustituta_id: number | null;
  horas_extra_generadas: number;
  clasificacion_he: ClasificacionHE | null;
  autorizado_por: string;
  autorizado_en: string;
}

export interface CoberturaEstandar {
  id: number;
  subarea: Subarea;
  turno: TurnoBase;
  dia_tipo: DiaTipo;
  personas_minimas: number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  aprobado_por: string;
  created_at: string;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  persona_vinculada_id: number | null;
  activo: 0 | 1;
  ultimo_acceso: string | null;
  created_at: string;
}

export interface Auditoria {
  id: number;
  tabla: string;
  registro_id: number;
  accion: AccionAuditoria;
  usuario_email: string;
  payload_anterior: string | null;
  payload_nuevo: string | null;
  timestamp: string;
}

// =============================================================
// Contexto de Cloudflare Workers
// =============================================================

export interface AppEnv {
  DB: D1Database;
  ENVIRONMENT: string;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BYPASS?: string;
}

// Usuario autenticado disponible en el contexto de Hono
export interface AuthUser {
  email: string;
  rol: Rol;
}

// =============================================================
// Tipos de respuesta API
// =============================================================

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// =============================================================
// DTOs de dominio
// =============================================================

export interface DeficitSubarea {
  subarea: Subarea;
  turno: TurnoBase;
  dia_tipo: DiaTipo;
  personas_planificadas: number;
  personas_minimas: number;
  deficit: number;
}

export interface DeficitReport {
  fecha: string;
  deficits: DeficitSubarea[];
  tiene_deficit: boolean;
}

export interface ValidationResult {
  valido: boolean;
  errores: string[];
}

export interface KpiDashboard {
  cumplimiento_cobertura: number;
  tasa_ausentismo: number;
  he_por_fallo_cobertura: number;
  rotacion_mensual: number;
  brecha_estructural: number;
}
