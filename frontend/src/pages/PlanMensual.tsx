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
  // Permite editar si el rol es admin/jefatura, o si aún no se resolvió el usuario (acceso abierto)
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

  // Ciclo de turnos: activos en orden + descanso al final
  const cicloTurnos = useMemo<string[]>(() => {
    const activos = (turnosConfig ?? []).filter(t => t.activo).map(t => t.codigo);
    return activos.length > 0 ? [...activos, 'descanso'] : ['D', 'N', 'descanso'];
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

  // Server plan indexed as [persona_id][fecha]
  const serverPlanMap = useMemo(() => {
    const m: DraftPlan = {};
    (plan ?? []).forEach((l) => {
      if (!m[l.persona_id]) m[l.persona_id] = {};
      m[l.persona_id]![l.fecha] = { turno: l.turno, subarea_asignada: l.subarea_asignada };
    });
    return m;
  }, [plan]);

  // Effective plan: server + draft overrides
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

  const estadoPlan = plan && plan.length > 0 ? plan[0]?.estado_plan : null;
  const estaAprobado = estadoPlan === 'aprobado';
  const hayPlan = plan && plan.length > 0;
  const hayDraft = draft !== null && Object.keys(draft).length > 0;

  // Builds all lines from effective plan (personas × fechas)
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
              Haz clic en un turno para cambiarlo: <strong>D</strong> → <strong>N</strong> → <strong>—</strong> (descanso)
            </p>
          )}
          <div className="overflow-x-auto border border-borde rounded">
            <table className="text-xs tabla-institucional min-w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left sticky left-0 bg-primario min-w-[160px]">Colaborador</th>
                  <th className="px-2 py-2 text-left bg-primario min-w-[90px]">Subárea</th>
                  {fechas.map((f) => (
                    <th key={f} className="px-1 py-2 text-center min-w-[26px] font-normal">
                      {f.slice(8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personaIdsMostrados.map((pid) => {
                  const persona = personaMap.get(pid);
                  const nombre = persona?.nombre ?? `ID ${pid}`;
                  const subarea = (persona?.subarea ?? '').replace(/_/g, ' ');
                  return (
                    <tr key={pid}>
                      <td className="px-3 py-1.5 sticky left-0 bg-white font-medium whitespace-nowrap border-r border-borde">
                        {nombre}
                      </td>
                      <td className="px-2 py-1.5 text-secundario capitalize whitespace-nowrap">
                        {subarea}
                      </td>
                      {fechas.map((f) => {
                        const cell = effectivePlan[pid]?.[f];
                        const turno = cell?.turno;
                        const isEdited = draft?.[pid]?.[f] !== undefined;
                        return (
                          <td key={f} className="px-0.5 py-1 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold select-none ${
                                turno ? turnoCls(turno) : 'text-gray-200'
                              } ${!estaAprobado && puedeEditar ? 'cursor-pointer hover:opacity-70' : ''} ${
                                isEdited ? 'ring-1 ring-offset-1 ring-yellow-400' : ''
                              }`}
                              onClick={() => toggleTurno(pid, f)}
                              title={!estaAprobado && puedeEditar ? 'Clic para cambiar turno' : undefined}
                            >
                              {turno ? turnoLabel(turno) : '·'}
                            </span>
                          </td>
                        );
                      })}
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
