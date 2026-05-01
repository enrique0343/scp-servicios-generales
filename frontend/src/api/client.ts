// Cliente HTTP tipado para la API del worker.
// Todos los tipos de retorno reflejan worker/src/types.ts.

export type Rol = 'admin' | 'jefatura' | 'supervisor' | 'lectura';
export type Subarea = 'limpieza' | 'jardineria' | 'lavanderia' | 'apoyo_logistico' | 'areas_comunes';
export type TurnoPlan = 'D' | 'N' | 'descanso';
export type EstadoPlaza = 'autorizada' | 'contratada' | 'vacante';
export type EstadoPersona = 'activo' | 'inactivo' | 'suspendido';

export interface AuthUser {
  email: string;
  rol: Rol;
}

export interface Plaza {
  id: number;
  codigo_plaza: string;
  subarea: Subarea;
  turno_base: 'D' | 'N';
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
  tipo_contrato: 'permanente' | 'temporal';
  created_at: string;
  updated_at: string;
}

export interface PlanMensual {
  id: number;
  persona_id: number;
  fecha: string;
  turno: TurnoPlan;
  subarea_asignada: Subarea;
  estado_plan: 'borrador' | 'aprobado';
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
  turno_real: 'D' | 'N' | 'descanso' | 'doble';
  estado: string;
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
  tipo: string;
  motivo_categoria: string;
  motivo_detalle: string | null;
  persona_sustituta_id: number | null;
  horas_extra_generadas: number;
  clasificacion_he: string | null;
  autorizado_por: string;
  autorizado_en: string;
}

export interface CoberturaEstandar {
  id: number;
  subarea: Subarea;
  turno: 'D' | 'N';
  dia_tipo: 'laboral' | 'sabado' | 'domingo' | 'feriado';
  personas_minimas: number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  aprobado_por: string;
  created_at: string;
}

export interface KpiDashboard {
  cumplimiento_cobertura: number;
  tasa_ausentismo: number;
  he_por_fallo_cobertura: number;
  rotacion_mensual: number;
  brecha_estructural: number;
}

// =============================================================
// Cliente base
// =============================================================

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Cloudflare Access redirige automáticamente; forzamos recarga para disparar el flujo OTP
    window.location.reload();
    throw new ApiError(401, 'UNAUTHORIZED', 'Sesión expirada');
  }

  const json = await res.json() as { data?: T; error?: { code: string; message: string } };

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error?.code ?? 'API_ERROR',
      json.error?.message ?? 'Error desconocido'
    );
  }

  return json.data as T;
}

// =============================================================
// Auth
// =============================================================

export const authApi = {
  me: () => request<AuthUser>('/auth/me'),
  crearUsuario: (data: { email: string; nombre: string; rol: Rol; persona_vinculada_id?: number }) =>
    request<{ mensaje: string }>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  desactivarUsuario: (email: string) =>
    request<{ mensaje: string }>(`/auth/users/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};

// =============================================================
// Plazas
// =============================================================

export const plazasApi = {
  listar: () => request<Plaza[]>('/plazas'),
  obtener: (id: number) => request<Plaza>(`/plazas/${id}`),
  crear: (data: Partial<Plaza>) =>
    request<{ id: number; mensaje: string }>('/plazas', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: number, data: Partial<Plaza>) =>
    request<{ mensaje: string }>(`/plazas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  coberturaSubarea: (id: number) => request<CoberturaEstandar[]>(`/plazas/${id}/cobertura`),
};

// =============================================================
// Personas (plantilla)
// =============================================================

export const personasApi = {
  listar: () => request<Persona[]>('/personas'),
  obtener: (id: number) => request<Persona>(`/personas/${id}`),
  crear: (data: Partial<Persona>) =>
    request<{ id: number; mensaje: string }>('/personas', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: number, data: Partial<Persona>) =>
    request<{ mensaje: string }>(`/personas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  baja: (id: number, data: { fecha_baja: string; motivo_categoria: string }) =>
    request<{ mensaje: string }>(`/personas/${id}/baja`, { method: 'POST', body: JSON.stringify(data) }),
};

// =============================================================
// Plan mensual
// =============================================================

export const planApi = {
  obtener: (yyyymm: string) => request<PlanMensual[]>(`/plan/${yyyymm}`),
  crear: (yyyymm: string, lineas: Omit<PlanMensual, 'id' | 'creado_en' | 'estado_plan' | 'creado_por' | 'aprobado_por' | 'aprobado_en'>[]) =>
    request<{ mensaje: string }>(`/plan/${yyyymm}`, { method: 'POST', body: JSON.stringify({ lineas }) }),
  aprobar: (yyyymm: string) =>
    request<{ mensaje: string }>(`/plan/${yyyymm}/aprobar`, { method: 'POST' }),
  deficit: (yyyymm: string) => request<unknown[]>(`/plan/${yyyymm}/deficit`),
};

// =============================================================
// Asistencia diaria
// =============================================================

export const asistenciaApi = {
  obtener: (fecha: string) => request<AsistenciaDiaria[]>(`/asistencia/${fecha}`),
  registrar: (fecha: string, data: Partial<AsistenciaDiaria>) =>
    request<{ mensaje: string }>(`/asistencia/${fecha}`, { method: 'POST', body: JSON.stringify(data) }),
  cerrarDia: (fecha: string) =>
    request<{ mensaje: string }>(`/asistencia/${fecha}/cerrar`, { method: 'POST' }),
};

// =============================================================
// Excepciones
// =============================================================

export const excepcionesApi = {
  listar: (desde?: string, hasta?: string, tipo?: string) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (tipo) params.set('tipo', tipo);
    return request<Excepcion[]>(`/excepciones?${params.toString()}`);
  },
  crear: (data: Partial<Excepcion>) =>
    request<{ id: number; mensaje: string }>('/excepciones', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: number, data: Partial<Excepcion>) =>
    request<{ mensaje: string }>(`/excepciones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// =============================================================
// Cobertura
// =============================================================

export const coberturaApi = {
  vigente: () => request<CoberturaEstandar[]>('/cobertura'),
  actualizar: (data: { reglas: Partial<CoberturaEstandar>[]; aprobado_por: string }) =>
    request<{ mensaje: string }>('/cobertura', { method: 'PUT', body: JSON.stringify(data) }),
};

// =============================================================
// Dashboard
// =============================================================

export const dashboardApi = {
  kpis: (desde?: string, hasta?: string, subarea?: string) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (subarea) params.set('subarea', subarea);
    return request<KpiDashboard>(`/dashboard/kpis?${params.toString()}`);
  },
  serieCobertura: (desde?: string, hasta?: string) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return request<unknown[]>(`/dashboard/serie-cobertura?${params.toString()}`);
  },
  distribucionAusencias: (desde?: string, hasta?: string) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return request<unknown[]>(`/dashboard/distribucion-ausencias?${params.toString()}`);
  },
  heClasificada: (desde?: string, hasta?: string) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return request<unknown[]>(`/dashboard/he-clasificada?${params.toString()}`);
  },
  export: (desde: string, hasta: string) => request<unknown[]>(`/dashboard/export?desde=${desde}&hasta=${hasta}`),
};

export { ApiError };
