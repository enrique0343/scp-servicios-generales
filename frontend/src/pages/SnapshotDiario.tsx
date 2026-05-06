import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { asistenciaApi, excepcionesApi, personasApi } from '../api/client';
import type { LineaVistaDiaria, Persona, Subarea } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const LABEL_SUBAREA: Record<Subarea, string> = {
  limpieza: 'Limpieza', jardineria: 'Jardinería', lavanderia: 'Lavandería',
  apoyo_logistico: 'Apoyo Logístico', areas_comunes: 'Áreas Comunes',
};

const AUSENCIA_ESTADOS = ['ausente_justificado', 'ausente_injustificado', 'incapacidad', 'permiso', 'vacaciones'];

function estadoBadge(estado: string) {
  const map: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }> = {
    presente:              { label: 'Presente',       variant: 'success'  },
    sustitucion:           { label: 'Sustitución',    variant: 'success'  },
    doble_turno:           { label: 'Doble turno',    variant: 'success'  },
    ausente_justificado:   { label: 'Ausente J.',     variant: 'warning'  },
    ausente_injustificado: { label: 'Ausente I.',     variant: 'danger'   },
    permiso:               { label: 'Permiso',        variant: 'warning'  },
    incapacidad:           { label: 'Incapacidad',    variant: 'warning'  },
    vacaciones:            { label: 'Vacaciones',     variant: 'neutral'  },
  };
  const d = map[estado] ?? { label: estado, variant: 'neutral' as const };
  return <Badge label={d.label} variant={d.variant} />;
}

function rowColor(linea: LineaVistaDiaria) {
  if (!linea.asistencia) return 'bg-yellow-50 hover:bg-yellow-100';
  const e = linea.asistencia.estado;
  if (['presente','sustitucion','doble_turno'].includes(e)) return 'hover:bg-green-50';
  if (AUSENCIA_ESTADOS.includes(e)) return 'bg-red-50 hover:bg-red-100';
  return 'hover:bg-bg-alt/50';
}

function navFecha(fecha: string, dias: number) {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ——— Modal: registrar asistencia (presente / doble turno) ———
interface ModalPresenciaProps {
  linea: LineaVistaDiaria;
  fecha: string;
  onClose: () => void;
  onSave: (data: object) => void;
  saving: boolean;
  error: string | null;
}
function ModalPresencia({ linea, fecha, onClose, onSave, saving, error }: ModalPresenciaProps) {
  const [form, setForm] = useState({
    estado: linea.asistencia?.estado ?? 'presente',
    turno_real: linea.asistencia?.turno_real ?? (linea.turno_planificado ?? 'D'),
    hora_entrada: linea.asistencia?.hora_entrada ?? '',
    hora_salida: linea.asistencia?.hora_salida ?? '',
    horas_trabajadas: linea.asistencia?.horas_trabajadas ?? 12,
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded border border-borde shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 className="font-medium text-primario mb-1">{linea.nombre}</h3>
        <p className="text-xs text-secundario mb-4">{LABEL_SUBAREA[linea.subarea]} · {fecha}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secundario block mb-1">Estado</label>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
              <option value="presente">Presente</option>
              <option value="doble_turno">Doble turno</option>
              <option value="sustitucion">Sustitución</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Turno real</label>
            <select value={form.turno_real} onChange={(e) => setForm({ ...form, turno_real: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
              <option value="D">Diurno</option>
              <option value="N">Nocturno</option>
              <option value="doble">Doble</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-secundario block mb-1">Hora entrada</label>
              <input type="time" value={form.hora_entrada}
                onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
                className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario" />
            </div>
            <div>
              <label className="text-xs text-secundario block mb-1">Hora salida</label>
              <input type="time" value={form.hora_salida}
                onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
                className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario" />
            </div>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Horas trabajadas</label>
            <input type="number" min="0" max="24" step="0.5" value={form.horas_trabajadas}
              onChange={(e) => setForm({ ...form, horas_trabajadas: Number(e.target.value) })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario" />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => onSave({
              persona_id: linea.persona_id,
              turno_planificado: linea.turno_planificado ?? 'D',
              turno_real: form.turno_real,
              estado: form.estado,
              hora_entrada: form.hora_entrada || null,
              hora_salida: form.hora_salida || null,
              horas_trabajadas: form.horas_trabajadas,
            })} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Modal: registrar excepción/ausencia ———
interface ModalExcepcionProps {
  linea: LineaVistaDiaria;
  fecha: string;
  personas: Persona[];
  onClose: () => void;
  onSave: (data: object) => void;
  saving: boolean;
  error: string | null;
}
function ModalExcepcion({ linea, fecha, personas, onClose, onSave, saving, error }: ModalExcepcionProps) {
  const [form, setForm] = useState({
    tipo: 'ausencia' as string,
    motivo_categoria: 'enfermedad' as string,
    motivo_detalle: '',
    persona_sustituta_id: '' as string | number,
    horas_extra_generadas: 12,
    clasificacion_he: 'por_fallo_cobertura' as string,
  });
  const necesitaSustituto = form.tipo === 'sustitucion' || form.tipo === 'doble_turno';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded border border-borde shadow-lg p-6 max-w-sm w-full mx-4 my-4">
        <h3 className="font-medium text-primario mb-1">{linea.nombre}</h3>
        <p className="text-xs text-secundario mb-4">{LABEL_SUBAREA[linea.subarea]} · {fecha}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secundario block mb-1">Tipo de excepción</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
              <option value="ausencia">Ausencia</option>
              <option value="sustitucion">Sustitución</option>
              <option value="doble_turno">Doble turno</option>
              <option value="cambio_area">Cambio de área</option>
              <option value="cambio_turno">Cambio de turno</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Motivo</label>
            <select value={form.motivo_categoria} onChange={(e) => setForm({ ...form, motivo_categoria: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
              <option value="enfermedad">Enfermedad / Incapacidad</option>
              <option value="permiso_personal">Permiso personal</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="falta_relevo">Falta de relevo</option>
              <option value="emergencia_operativa">Emergencia operativa</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Detalle (opcional)</label>
            <input type="text" maxLength={200} value={form.motivo_detalle}
              onChange={(e) => setForm({ ...form, motivo_detalle: e.target.value })}
              placeholder="Ej. Cita médica urgente"
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario" />
          </div>
          {necesitaSustituto && (
            <>
              <div>
                <label className="text-xs text-secundario block mb-1">Colaborador que cubre</label>
                <select value={form.persona_sustituta_id}
                  onChange={(e) => setForm({ ...form, persona_sustituta_id: e.target.value })}
                  className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
                  <option value="">— Seleccionar —</option>
                  {personas.filter((p) => p.id !== linea.persona_id).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({LABEL_SUBAREA[p.subarea]})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-secundario block mb-1">Horas extra generadas</label>
                <input type="number" min="0" max="24" step="0.5" value={form.horas_extra_generadas}
                  onChange={(e) => setForm({ ...form, horas_extra_generadas: Number(e.target.value) })}
                  className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario" />
              </div>
              <div>
                <label className="text-xs text-secundario block mb-1">Clasificación HE</label>
                <select value={form.clasificacion_he}
                  onChange={(e) => setForm({ ...form, clasificacion_he: e.target.value })}
                  className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario">
                  <option value="por_fallo_cobertura">Por fallo de cobertura</option>
                  <option value="planificada">Planificada</option>
                  <option value="por_demanda">Por demanda</option>
                </select>
              </div>
            </>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => onSave({
              fecha,
              persona_afectada_id: linea.persona_id,
              tipo: form.tipo,
              motivo_categoria: form.motivo_categoria,
              motivo_detalle: form.motivo_detalle || null,
              persona_sustituta_id: form.persona_sustituta_id ? Number(form.persona_sustituta_id) : null,
              horas_extra_generadas: necesitaSustituto ? form.horas_extra_generadas : 0,
              clasificacion_he: necesitaSustituto ? form.clasificacion_he : null,
            })} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSucursal(area: string) { return area.split(' - ')[0]; }

// ——— Página principal ———
export default function SnapshotDiario() {
  const { fecha } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fechaActual = fecha ?? new Date().toISOString().slice(0, 10);
  const puedeEditar = useRequireRole(['admin', 'jefatura', 'supervisor']);
  const puedeCerrar = useRequireRole(['admin', 'jefatura']);

  const [sucursalFiltro, setSucursalFiltro] = useState<string>('');
  const [modalPresencia, setModalPresencia] = useState<LineaVistaDiaria | null>(null);
  const [modalExcepcion, setModalExcepcion] = useState<LineaVistaDiaria | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const { data: vista, isLoading } = useQuery({
    queryKey: ['vista-diaria', fechaActual],
    queryFn: () => asistenciaApi.vista(fechaActual),
  });

  const { data: personas = [] } = useQuery({
    queryKey: ['personas'],
    queryFn: personasApi.listar,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['vista-diaria', fechaActual] });
  };

  const registrarAsistencia = useMutation({
    mutationFn: (data: object) => asistenciaApi.registrar(fechaActual, data as Parameters<typeof asistenciaApi.registrar>[1]),
    onSuccess: () => { setModalPresencia(null); setErrorModal(null); invalidar(); },
    onError: (e: Error) => setErrorModal(e.message),
  });

  const registrarExcepcion = useMutation({
    mutationFn: (data: object) => excepcionesApi.crear(data as Parameters<typeof excepcionesApi.crear>[0]),
    onSuccess: () => { setModalExcepcion(null); setErrorModal(null); invalidar(); },
    onError: (e: Error) => setErrorModal(e.message),
  });

  const cerrarDia = useMutation({
    mutationFn: () => asistenciaApi.cerrarDia(fechaActual),
    onSuccess: invalidar,
  });

  const todasLineas = vista?.lineas ?? [];
  const resumen = vista?.resumen;
  const diaCerrado = todasLineas.length > 0 && todasLineas.every((l) => l.asistencia?.cerrado === 1);

  // Sucursales únicas derivadas de los datos
  const sucursales = [...new Set(todasLineas.map((l) => getSucursal(l.area ?? '')).filter((s): s is string => !!s))].sort();

  // Filtro por sucursal
  const lineas = sucursalFiltro
    ? todasLineas.filter((l) => getSucursal(l.area ?? '') === sucursalFiltro)
    : todasLineas;

  // Agrupar por subárea (planificados) + extras al final
  const subareasOrden: Subarea[] = ['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes'];
  const planificadas = lineas.filter((l) => l.en_plan);
  const extras = lineas.filter((l) => !l.en_plan);

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-primario">Asistencia Diaria</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/asistencia/${navFecha(fechaActual, -1)}`)}>‹</Button>
          <input
            type="date"
            value={fechaActual}
            onChange={(e) => navigate(`/asistencia/${e.target.value}`)}
            className="border border-borde rounded px-2 py-1 text-sm focus:outline-none focus:border-primario"
          />
          <Button variant="ghost" size="sm" onClick={() => navigate(`/asistencia/${navFecha(fechaActual, 1)}`)}>›</Button>
        </div>
      </div>

      {/* Filtro por sucursal */}
      {sucursales.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSucursalFiltro('')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${sucursalFiltro === '' ? 'bg-primario text-white border-primario' : 'border-borde text-secundario hover:border-primario hover:text-primario'}`}
          >
            Todas
          </button>
          {sucursales.map((s) => (
            <button
              key={s}
              onClick={() => setSucursalFiltro(s)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${sucursalFiltro === s ? 'bg-primario text-white border-primario' : 'border-borde text-secundario hover:border-primario hover:text-primario'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Planificados', value: resumen.planificados, color: 'text-primario' },
            { label: 'Presentes',    value: resumen.presentes,    color: 'text-green-600' },
            { label: 'Ausentes',     value: resumen.ausentes,     color: 'text-red-500'   },
            { label: 'Sin registro', value: resumen.sin_registro,  color: 'text-yellow-600'},
            { label: 'Horas totales',value: resumen.horas_totales.toFixed(1), color: 'text-secundario' },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-borde rounded p-3 text-center shadow-sm">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-secundario mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Estado + cerrar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge label={diaCerrado ? 'Día cerrado' : 'Día abierto'} variant={diaCerrado ? 'success' : 'warning'} />
        {puedeCerrar && !diaCerrado && lineas.length > 0 && (
          <Button size="sm" onClick={() => {
            if (confirm(`¿Cerrar el día ${fechaActual}? No se podrán registrar más cambios.`)) cerrarDia.mutate();
          }} disabled={cerrarDia.isPending}>
            {cerrarDia.isPending ? 'Cerrando...' : 'Cerrar día'}
          </Button>
        )}
      </div>

      {isLoading && <div className="text-secundario text-sm">Cargando...</div>}

      {/* Tabla planificados agrupados por subárea */}
      {!isLoading && planificadas.length === 0 && (
        <div className="border border-borde rounded p-8 text-center">
          <p className="text-secundario text-sm">No hay plan registrado para {fechaActual}</p>
          <p className="text-xs text-secundario mt-1">Crea el plan mensual para ver la planificación del día</p>
        </div>
      )}

      {!isLoading && planificadas.length > 0 && (
        <div className="space-y-4">
          {subareasOrden.map((sub) => {
            const filas = planificadas.filter((l) => l.subarea === sub);
            if (filas.length === 0) return null;
            return (
              <div key={sub} className="bg-white border border-borde rounded shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-bg-alt border-b border-borde">
                  <span className="text-xs font-semibold text-primario uppercase tracking-wide">{LABEL_SUBAREA[sub]}</span>
                  <span className="ml-2 text-xs text-secundario">{filas.filter(l => l.asistencia?.estado && ['presente','sustitucion','doble_turno'].includes(l.asistencia.estado)).length}/{filas.length} presentes</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-secundario border-b border-borde">
                      <th className="px-4 py-2 text-left">Colaborador</th>
                      <th className="px-4 py-2 text-center">Plan</th>
                      <th className="px-4 py-2 text-left">Estado</th>
                      <th className="px-4 py-2 text-right">Entrada</th>
                      <th className="px-4 py-2 text-right">Salida</th>
                      <th className="px-4 py-2 text-right">Horas</th>
                      {puedeEditar && <th className="px-4 py-2 text-right">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {filas.map((linea) => (
                      <tr key={linea.persona_id} className={`transition-colors ${rowColor(linea)}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-primario">{linea.nombre}</div>
                          <div className="text-xs text-secundario">{linea.codigo_empleado}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-mono">
                          {linea.turno_planificado === 'D' ? 'Diurno' : linea.turno_planificado === 'N' ? 'Nocturno' : linea.turno_planificado}
                        </td>
                        <td className="px-4 py-2.5">
                          {linea.asistencia
                            ? estadoBadge(linea.asistencia.estado)
                            : <span className="text-xs text-yellow-600 font-medium">Sin registro</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-secundario">{linea.asistencia?.hora_entrada ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-secundario">{linea.asistencia?.hora_salida ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs">{linea.asistencia ? linea.asistencia.horas_trabajadas.toFixed(1) : '—'}</td>
                        {puedeEditar && (
                          <td className="px-4 py-2.5 text-right">
                            {linea.asistencia?.cerrado === 1 ? (
                              <Badge label="Cerrado" variant="neutral" />
                            ) : (
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => { setModalPresencia(linea); setErrorModal(null); }}
                                  className="text-xs text-primario hover:underline">
                                  {linea.asistencia ? 'Editar' : 'Marcar'}
                                </button>
                                <button onClick={() => { setModalExcepcion(linea); setErrorModal(null); }}
                                  className="text-xs text-secundario hover:text-danger hover:underline">
                                  Excepción
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Extras / sustitutos sin plan */}
      {!isLoading && extras.length > 0 && (
        <div className="bg-white border border-borde rounded shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-blue-50 border-b border-borde">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cobertura extra / Sustitutos</span>
            <span className="ml-2 text-xs text-secundario">No estaban en el plan original</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-secundario border-b border-borde">
                <th className="px-4 py-2 text-left">Colaborador</th>
                <th className="px-4 py-2 text-left">Subárea</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {extras.map((linea) => (
                <tr key={linea.persona_id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-primario">{linea.nombre}</div>
                    <div className="text-xs text-secundario">{linea.codigo_empleado}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-secundario">{LABEL_SUBAREA[linea.subarea]}</td>
                  <td className="px-4 py-2.5">{linea.asistencia ? estadoBadge(linea.asistencia.estado) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{linea.asistencia ? linea.asistencia.horas_trabajadas.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal presencia */}
      {modalPresencia && (
        <ModalPresencia
          linea={modalPresencia}
          fecha={fechaActual}
          onClose={() => { setModalPresencia(null); setErrorModal(null); }}
          onSave={(data) => registrarAsistencia.mutate(data)}
          saving={registrarAsistencia.isPending}
          error={errorModal}
        />
      )}

      {/* Modal excepción */}
      {modalExcepcion && (
        <ModalExcepcion
          linea={modalExcepcion}
          fecha={fechaActual}
          personas={personas}
          onClose={() => { setModalExcepcion(null); setErrorModal(null); }}
          onSave={(data) => registrarExcepcion.mutate(data)}
          saving={registrarExcepcion.isPending}
          error={errorModal}
        />
      )}
    </div>
  );
}
