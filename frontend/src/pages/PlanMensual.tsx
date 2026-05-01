import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { planApi, type PlanMensual as PlanMensualType } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
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

export default function PlanMensual() {
  const { yyyymm } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mesActual = yyyymm ?? new Date().toISOString().slice(0, 7);
  const puedeEditar = useRequireRole(['admin', 'jefatura']);

  const { data: plan, isLoading, error } = useQuery<PlanMensualType[]>({
    queryKey: ['plan', mesActual],
    queryFn: () => planApi.obtener(mesActual),
  });

  const aprobar = useMutation({
    mutationFn: () => planApi.aprobar(mesActual),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['plan', mesActual] }),
  });

  const estadoPlan = plan && plan.length > 0 ? plan[0]?.estado_plan : null;
  const estaAprobado = estadoPlan === 'aprobado';

  // Agrupa por persona para mostrar en tabla
  const personaIds = [...new Set((plan ?? []).map((l) => l.persona_id))];
  const fechas = [...new Set((plan ?? []).map((l) => l.fecha))].sort();

  const turnoLabel: Record<string, string> = { D: 'D', N: 'N', descanso: '—' };

  return (
    <div className="space-y-4">
      {/* Header con navegación de meses */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Plan Mensual</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/plan/${mesAnterior(mesActual)}`)}>
            &lsaquo; Anterior
          </Button>
          <span className="text-sm font-medium px-2">{mesActual}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/plan/${mesSiguiente(mesActual)}`)}>
            Siguiente &rsaquo;
          </Button>
        </div>
      </div>

      {/* Estado del plan y acciones */}
      <div className="flex items-center gap-3">
        {estadoPlan && (
          <Badge
            label={estaAprobado ? 'Aprobado' : 'Borrador'}
            variant={estaAprobado ? 'success' : 'warning'}
          />
        )}
        {puedeEditar && !estaAprobado && plan && plan.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (confirm(`¿Aprobar el plan de ${mesActual}?`)) {
                aprobar.mutate();
              }
            }}
            disabled={aprobar.isPending}
          >
            {aprobar.isPending ? 'Aprobando...' : 'Aprobar plan'}
          </Button>
        )}
      </div>

      {isLoading && <div className="text-secundario text-sm">Cargando plan...</div>}
      {error && <div className="text-danger text-sm">Error al cargar el plan</div>}

      {!isLoading && plan && plan.length === 0 && (
        <div className="border border-borde rounded p-8 text-center">
          <p className="text-secundario text-sm">No hay plan registrado para {mesActual}</p>
        </div>
      )}

      {/* Tabla plan (personas × días) */}
      {!isLoading && plan && plan.length > 0 && (
        <div className="overflow-x-auto border border-borde rounded">
          <table className="text-xs tabla-institucional min-w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-primario">Persona</th>
                {fechas.map((f) => (
                  <th key={f} className="px-1.5 py-2 text-center min-w-[32px]">
                    {f.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personaIds.map((pid) => {
                const lineasPersona = plan.filter((l) => l.persona_id === pid);
                return (
                  <tr key={pid}>
                    <td className="px-3 py-1.5 sticky left-0 bg-white font-medium">
                      ID {pid}
                    </td>
                    {fechas.map((f) => {
                      const linea = lineasPersona.find((l) => l.fecha === f);
                      return (
                        <td key={f} className="px-1.5 py-1.5 text-center">
                          {linea ? (
                            <span
                              className={`inline-block w-6 h-6 rounded text-center leading-6 text-xs font-semibold ${
                                linea.turno === 'D'
                                  ? 'bg-blue-100 text-blue-700'
                                  : linea.turno === 'N'
                                  ? 'bg-gray-800 text-white'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {turnoLabel[linea.turno] ?? '?'}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
