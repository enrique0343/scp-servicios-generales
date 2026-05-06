import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  planApi, personasApi, plazasApi, turnosApi,
  type PlanMensual as PlanMensualType,
  type Persona, type Plaza, type TurnoPlan, type Subarea, type TurnoConfig,
} from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

function mesAnterior(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesSiguiente(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function diasDelMes(yyyymm: string): string[] {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return [];
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${yyyymm}-${String(i + 1).padStart(2, '0')}`);
}

function getSucursal(area: string): string {
  return area.split(' - ')[0] ?? area;
}

// L M X J V S D — X for Wednesday to avoid clash with Martes
const DIA_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

function diaSemana(fecha: string): string {
  return DIA_SEMANA[new Date(fecha + 'T12:00:00').getDay()] ?? '';
}

function esFinDeSemana(fecha: string): boolean {
  const d = new Date(fecha + 'T12:00:00').getDay();
  return d === 0 || d === 6;
}

// Parse "HH:MM" → minutes from midnight
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// Minutes of overlap between segment [a,b] and the diurnal window [360, 1140] (06:00–19:00)
function overlapDiurnal(a: number, b: number): number {
  return Math.max(0, Math.min(b, 1140) - Math.max(a, 360));
}

// Returns { diurnas, nocturnas } hours for a TurnoConfig
function calcDiurnasNocturnas(t: TurnoConfig): { diurnas: number; nocturnas: number } {
  const ini = toMin(t.hora_inicio);
  const fin = toMin(t.hora_fin);
  const diurnasMin = t.cruza_medianoche
    ? overlapDiurnal(ini, 1440) + overlapDiurnal(0, fin)
    : overlapDiurnal(ini, fin);
  const diurnas = diurnasMin / 60;
  return { diurnas, nocturnas: t.horas_duracion - diurnas };
}

function fmtH(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

type PlanCell = { turno: TurnoPlan; subarea_asignada: Subarea };
type DraftPlan = Record<number, Record<string, PlanCell>>;

const TURNO_CLS_BASE: Record<string, string> = {
  D: 'bg-blue-100 text-blue-700',
  N: 'bg-gray-800 text-white',
  '8A': 'bg-green-100 text-green-700',
  '8B': 'bg-orange-100 text-orange-700',
  '24': 'bg-purple-100 text-purple-700',
  descanso: 'bg-gray-100 text-gray-400',
};

function turnoLabel(codigo: string): string {
  return codigo === 'descanso' ? '—' : codigo;
}

function turnoCls(codigo: string): string {
  return TURNO_CLS_BASE[codigo] ?? 'bg-yellow-100 text-yellow-700';
}

export default function PlanMensual() {
  const { yyyymm } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mesActual = yyyymm ?? new Date().toISOString().slice(0, 7);
  const { rol } = useAuth();
  const puedeEditar = rol === null || rol === 'admin' || rol === 'jefatura';
  const fechas = useMemo(() => diasDelMes(mesActual), [mesActual]);

  const { data: plan, isLoading: planLoading } = useQuery<PlanMensualType[]>({
    queryKey: ['plan', mesActual],
    queryFn: () => planApi.obtener(mesActual),
  });

  const { data: personas } = useQuery<Persona[]>({
    queryKey: ['personas'],
    queryFn: personasApi.listar,
  });

  const { data: plazas } = useQuery<Plaza[]>({
    queryKey: ['plazas'],
    queryFn: plazasApi.listar,
  });

  const { data: turnosConfig } = useQuery<TurnoConfig[]>({
    queryKey: ['turnos'],
    queryFn: turnosApi.listar,
  });

  const cicloTurnos = useMemo<string[]>(() => {
    const activos = (turnosConfig ?? []).filter(t => t.activo).map(t => t.codigo);
    return activos.length > 0 ? [...activos, 'descanso'] : ['D', 'N', 'descanso'];
  }, [turnosConfig]);

  // Map turno code → TurnoConfig for fast lookup
  const turnoMap = useMemo(() => {
    const m = new Map<string, TurnoConfig>();
    (turnosConfig ?? []).forEach(t => m.set(t.codigo, t));
    return m;
  }, [turnosConfig]);

  const [draft, setDraft] = useState<DraftPlan | null>(null);
  const [sucursalFiltro, setSucursalFiltro] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const personaMap = useMemo(() => {
    const m = new Map<number, Persona>();
    (personas ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [personas]);

  const plazaByPersona = useMemo(() => {
    const m = new Map<number, Plaza>();
    (plazas ?? []).forEach((pl) => { if (pl.persona_id != null) m.set(pl.persona_id, pl); });
    return m;
  }, [plazas]);

  const serverPlanMap = useMemo(() => {
    const m: DraftPlan = {};
    (plan ?? []).forEach((l) => {
      if (!m[l.persona_id]) m[l.persona_id] = {};
      m[l.persona_id]![l.fecha] = { turno: l.turno, subarea_asignada: l.subarea_asignada };
    });
    return m;
  }, [plan]);

  const effectivePlan = useMemo((): DraftPlan => {
    if (!draft) return serverPlanMap;
    const merged: DraftPlan = {};
    const allIds = new Set([...Object.keys(serverPlanMap), ...Object.keys(draft)].map(Number));
    for (const pid of allIds) {
      merged[pid] = { ...(serverPlanMap[pid] ?? {}), ...(draft[pid] ?? {}) };
    }
    return merged;
  }, [serverPlanMap, draft]);

  const personasConPlaza = useMemo(() => {
    return (personas ?? []).filter((p) => plazaByPersona.has(p.id));
  }, [personas, plazaByPersona]);

  const personaIdsMostrados = useMemo(() => {
    const ids = personasConPlaza.map((p) => p.id);
    ids.sort((a, b) => {
      const na = personaMap.get(a)?.nombre ?? '';
      const nb = personaMap.get(b)?.nombre ?? '';
      return na.localeCompare(nb);
    });
    if (!sucursalFiltro) return ids;
    return ids.filter((id) => {
      const p = personaMap.get(id);
      return p && getSucursal(p.area) === sucursalFiltro;
    });
  }, [personasConPlaza, personaMap, sucursalFiltro]);

  const sucursales = useMemo(() => {
    const set = new Set<string>();
    personasConPlaza.forEach((p) => set.add(getSucursal(p.area)));
    return [...set].sort();
  }, [personasConPlaza]);

  // Monthly hours per collaborator: total, diurnas, nocturnas
  const resumenHoras = useMemo(() => {
    const result: Record<number, { total: number; diurnas: number; nocturnas: number }> = {};
    for (const pid of personaIdsMostrados) {
      let total = 0, diurnas = 0, nocturnas = 0;
      for (const fecha of fechas) {
        const codigo = effectivePlan[pid]?.[fecha]?.turno;
        if (!codigo || codigo === 'descanso') continue;
        const tc = turnoMap.get(codigo);
        if (!tc) continue;
        total += tc.horas_duracion;
        const { diurnas: d, nocturnas: n } = calcDiurnasNocturnas(tc);
        diurnas += d;
        nocturnas += n;
      }
      result[pid] = { total, diurnas, nocturnas };
    }
    return result;
  }, [personaIdsMostrados, effectivePlan, fechas, turnoMap]);

  const estadoPlan = plan && plan.length > 0 ? plan[0]?.estado_plan : null;
  const estaAprobado = estadoPlan === 'aprobado';
  const hayPlan = plan && plan.length > 0;
  const hayDraft = draft !== null && Object.keys(draft).length > 0;

  function buildLineas() {
    return personasConPlaza.flatMap((persona) => {
      const plaza = plazaByPersona.get(persona.id)!;
      return fechas.map((fecha) => {
        const cell = effectivePlan[persona.id]?.[fecha];
        return {
          persona_id: persona.id,
          fecha,
          turno: cell?.turno ?? (plaza.turno_base as TurnoPlan),
          subarea_asignada: cell?.subarea_asignada ?? persona.subarea,
        };
      });
    });
  }

  const guardar = useMutation({
    mutationFn: (lineas: ReturnType<typeof buildLineas>) =>
      planApi.crear(mesActual, lineas),
    onSuccess: () => {
      setDraft(null);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ['plan', mesActual] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const aprobar = useMutation({
    mutationFn: () => planApi.aprobar(mesActual),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['plan', mesActual] }),
    onError: (e: Error) => setErrorMsg(e.message),
  });

  function generarPlanBase() {
    if (!personas || !plazas) return;
    setDraft(null);
    guardar.mutate(buildLineas());
  }

  function toggleTurno(personaId: number, fecha: string) {
    if (!puedeEditar || estaAprobado) return;
    const persona = personaMap.get(personaId);
    if (!persona) return;
    const currentCell = effectivePlan[personaId]?.[fecha];
    const currentTurno = currentCell?.turno ?? (plazaByPersona.get(personaId)?.turno_base as TurnoPlan | undefined) ?? 'D';
    const idx = cicloTurnos.indexOf(currentTurno);
    const nextTurno = cicloTurnos[(idx + 1) % cicloTurnos.length] ?? 'descanso';
    setDraft((prev) => ({
      ...(prev ?? {}),
      [personaId]: {
        ...(prev?.[personaId] ?? {}),
        [fecha]: { turno: nextTurno, subarea_asignada: currentCell?.subarea_asignada ?? persona.subarea },
      },
    }));
  }

  function guardarCambios() {
    guardar.mutate(buildLineas());
  }

  function descartarCambios() {
    setDraft(null);
    setErrorMsg(null);
  }

  // Turno detail tooltip
  function turnoTitle(codigo: string): string {
    if (codigo === 'descanso') return 'Descanso';
    const tc = turnoMap.get(codigo);
    if (!tc) return codigo;
    return `${tc.nombre} · ${tc.hora_inicio}–${tc.hora_fin} (${tc.horas_duracion}h)`;
  }

  const turnosActivos = (turnosConfig ?? []).filter(t => t.activo);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Plan Mensual</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft(null); navigate(`/plan/${mesAnterior(mesActual)}`); }}>
            &lsaquo; Anterior
          </Button>
          <span className="text-sm font-medium px-2">{mesActual}</span>
          <Button variant="ghost" size="sm" onClick={() => { setDraft(null); navigate(`/plan/${mesSiguiente(mesActual)}`); }}>
            Siguiente &rsaquo;
          </Button>
        </div>
      </div>

      {/* Estado + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        {estadoPlan && (
          <Badge
            label={estaAprobado ? 'Aprobado' : 'Borrador'}
            variant={estaAprobado ? 'success' : 'warning'}
          />
        )}
        {hayDraft && (
          <>
            <Button variant="primary" size="sm" onClick={guardarCambios} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button variant="ghost" size="sm" onClick={descartarCambios} disabled={guardar.isPending}>
              Descartar
            </Button>
          </>
        )}
        {puedeEditar && !estaAprobado && hayPlan && !hayDraft && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (confirm(`¿Aprobar el plan de ${mesActual}? Esta acción no se puede revertir.`)) {
                aprobar.mutate();
              }
            }}
            disabled={aprobar.isPending}
          >
            {aprobar.isPending ? 'Aprobando...' : 'Aprobar plan'}
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-xs text-red-700 whitespace-pre-wrap">
          {errorMsg}
        </div>
      )}

      {/* Leyenda de turnos */}
      {turnosActivos.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center border border-borde rounded px-3 py-2 bg-gray-50">
          <span className="text-xs text-secundario font-medium mr-1">Turnos:</span>
          {turnosActivos.map(t => {
            const { diurnas, nocturnas } = calcDiurnasNocturnas(t);
            return (
              <span
                key={t.codigo}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${turnoCls(t.codigo)}`}
                title={`${t.nombre}\n${t.hora_inicio}–${t.hora_fin} · ${t.horas_duracion}h total\nDiurnas: ${fmtH(diurnas)}h · Nocturnas: ${fmtH(nocturnas)}h`}
              >
                {t.codigo}
                <span className="font-normal opacity-80 hidden sm:inline">{t.hora_inicio}–{t.hora_fin} · {t.horas_duracion}h</span>
              </span>
            );
          })}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${turnoCls('descanso')}`}>
            — <span className="font-normal opacity-80 hidden sm:inline">descanso</span>
          </span>
          <span className="text-xs text-secundario ml-2 hidden md:inline">
            · Diurnas: 06:00–19:00 · Nocturnas: 19:00–06:00
          </span>
        </div>
      )}

      {planLoading && <div className="text-secundario text-sm">Cargando plan...</div>}

      {/* Sin plan */}
      {!planLoading && !hayPlan && puedeEditar && (
        <div className="border border-borde rounded p-8 text-center space-y-3">
          <p className="text-secundario text-sm">No hay plan registrado para {mesActual}</p>
          <Button
            variant="primary"
            size="sm"
            onClick={generarPlanBase}
            disabled={guardar.isPending || !personas || !plazas}
          >
            {guardar.isPending ? 'Generando...' : 'Generar plan base'}
          </Button>
          <p className="text-xs text-secundario">
            Crea un borrador usando el turno base de cada plaza. Podrás editar los turnos antes de aprobar.
          </p>
        </div>
      )}

      {!planLoading && !hayPlan && !puedeEditar && (
        <div className="border border-borde rounded p-8 text-center">
          <p className="text-secundario text-sm">No hay plan registrado para {mesActual}</p>
        </div>
      )}

      {/* Filtro sucursal */}
      {!planLoading && hayPlan && sucursales.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${!sucursalFiltro ? 'bg-primario text-white border-primario' : 'bg-white text-secundario border-borde hover:border-primario'}`}
            onClick={() => setSucursalFiltro(null)}
          >
            Todas
          </button>
          {sucursales.map((s) => (
            <button
              key={s}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${sucursalFiltro === s ? 'bg-primario text-white border-primario' : 'bg-white text-secundario border-borde hover:border-primario'}`}
              onClick={() => setSucursalFiltro(sucursalFiltro === s ? null : s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Tabla plan */}
      {!planLoading && hayPlan && (
        <>
          {!estaAprobado && puedeEditar && (
            <p className="text-xs text-secundario">
              Haz clic en un turno para cambiarlo. Las horas del mes se actualizan automáticamente.
            </p>
          )}
          <div className="overflow-x-auto border border-borde rounded">
            <table className="text-xs tabla-institucional min-w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left sticky left-0 bg-primario min-w-[160px]">
                  <span className="text-white/40 text-[10px] mr-1.5">#</span>Colaborador
                </th>
                  <th className="px-2 py-2 text-left bg-primario min-w-[90px]">Subárea</th>
                  {fechas.map((f) => (
                    <th
                      key={f}
                      className={`px-1 py-1 text-center min-w-[26px] font-normal leading-tight ${esFinDeSemana(f) ? 'bg-white/10' : ''}`}
                    >
                      <div className="text-[9px] opacity-60">{diaSemana(f)}</div>
                      <div>{f.slice(8)}</div>
                    </th>
                  ))}
                  {/* Summary columns */}
                  <th className="px-2 py-2 text-right bg-primario min-w-[38px] border-l border-white/20" title="Total horas en el mes">Hs</th>
                  <th className="px-2 py-2 text-right bg-blue-700 min-w-[38px]" title="Horas diurnas (06:00–19:00)">Diur</th>
                  <th className="px-2 py-2 text-right bg-indigo-800 min-w-[38px]" title="Horas nocturnas (19:00–06:00)">Noc</th>
                </tr>
              </thead>
              <tbody>
                {personaIdsMostrados.map((pid, idx) => {
                  const persona = personaMap.get(pid);
                  const nombre = persona?.nombre ?? `ID ${pid}`;
                  const subarea = (persona?.subarea ?? '').replace(/_/g, ' ');
                  const res = resumenHoras[pid] ?? { total: 0, diurnas: 0, nocturnas: 0 };
                  return (
                    <tr key={pid}>
                      <td className="px-3 py-1.5 sticky left-0 bg-white font-medium whitespace-nowrap border-r border-borde">
                        <span className="text-secundario/40 text-[10px] mr-1.5 tabular-nums">{idx + 1}</span>{nombre}
                      </td>
                      <td className="px-2 py-1.5 text-secundario capitalize whitespace-nowrap">
                        {subarea}
                      </td>
                      {fechas.map((f) => {
                        const cell = effectivePlan[pid]?.[f];
                        const turno = cell?.turno;
                        const isEdited = draft?.[pid]?.[f] !== undefined;
                        return (
                          <td key={f} className={`px-0.5 py-1 text-center ${esFinDeSemana(f) ? 'bg-gray-50' : ''}`}>
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold select-none ${
                                turno ? turnoCls(turno) : 'text-gray-200'
                              } ${!estaAprobado && puedeEditar ? 'cursor-pointer hover:opacity-70' : ''} ${
                                isEdited ? 'ring-1 ring-offset-1 ring-yellow-400' : ''
                              }`}
                              onClick={() => toggleTurno(pid, f)}
                              title={turno ? turnoTitle(turno) : undefined}
                            >
                              {turno ? turnoLabel(turno) : '·'}
                            </span>
                          </td>
                        );
                      })}
                      {/* Hours summary */}
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums border-l border-borde">
                        {fmtH(res.total)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-blue-700 tabular-nums">
                        {fmtH(res.diurnas)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-indigo-700 tabular-nums">
                        {fmtH(res.nocturnas)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
