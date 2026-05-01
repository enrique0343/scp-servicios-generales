import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type KpiDashboard } from '../api/client';

function KpiCard({ label, value, meta, unidad }: { label: string; value: number; meta?: string; unidad?: string }) {
  return (
    <div className="border border-borde rounded p-4 bg-white">
      <div className="text-xs text-secundario uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-primario">
        {value.toFixed(1)}{unidad ?? ''}
      </div>
      {meta && <div className="text-xs text-secundario mt-1">Meta: {meta}</div>}
    </div>
  );
}

export default function Dashboard() {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = hoy.slice(0, 7) + '-01';

  const { data: kpis, isLoading, error } = useQuery<KpiDashboard>({
    queryKey: ['dashboard-kpis', inicioMes, hoy],
    queryFn: () => dashboardApi.kpis(inicioMes, hoy),
  });

  const { data: serieCobertura } = useQuery({
    queryKey: ['serie-cobertura', inicioMes, hoy],
    queryFn: () => dashboardApi.serieCobertura(inicioMes, hoy),
  });

  const { data: distribucion } = useQuery({
    queryKey: ['distribucion-ausencias', inicioMes, hoy],
    queryFn: () => dashboardApi.distribucionAusencias(inicioMes, hoy),
  });

  if (isLoading) return <div className="text-secundario text-sm">Cargando indicadores...</div>;
  if (error) return <div className="text-danger text-sm">Error al cargar el dashboard</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-primario">Dashboard Ejecutivo</h1>
      <p className="text-xs text-secundario">{inicioMes} al {hoy}</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Cumplimiento cobertura" value={kpis?.cumplimiento_cobertura ?? 0} meta="≥ 95 %" unidad=" %" />
        <KpiCard label="Tasa ausentismo" value={kpis?.tasa_ausentismo ?? 0} meta="< 3 %" unidad=" %" />
        <KpiCard label="HE fallo cobertura" value={kpis?.he_por_fallo_cobertura ?? 0} meta="< 30 %" unidad=" %" />
        <KpiCard label="Rotación mensual" value={kpis?.rotacion_mensual ?? 0} meta="< 5 %" unidad=" %" />
        <KpiCard label="Brecha estructural" value={kpis?.brecha_estructural ?? 0} meta="= 0" unidad=" plazas" />
      </div>

      {/* Serie cobertura */}
      <div className="border border-borde rounded p-4">
        <h2 className="text-sm font-semibold text-primario mb-3">Cobertura diaria (presentes vs planificados)</h2>
        {!serieCobertura || (serieCobertura as unknown[]).length === 0 ? (
          <p className="text-xs text-secundario">Sin datos de asistencia en el periodo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabla-institucional">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-right">Presentes</th>
                  <th className="px-3 py-2 text-right">Planificados</th>
                  <th className="px-3 py-2 text-right">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {(serieCobertura as Array<{ fecha: string; presentes: number; planificadas: number }>).map((row) => {
                  const pct = row.planificadas > 0 ? ((row.presentes / row.planificadas) * 100).toFixed(1) : '—';
                  return (
                    <tr key={row.fecha}>
                      <td className="px-3 py-1.5">{row.fecha}</td>
                      <td className="px-3 py-1.5 text-right">{row.presentes}</td>
                      <td className="px-3 py-1.5 text-right">{row.planificadas}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{pct}{pct !== '—' ? ' %' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribución ausencias */}
      <div className="border border-borde rounded p-4">
        <h2 className="text-sm font-semibold text-primario mb-3">Distribución de ausencias por motivo</h2>
        {!distribucion || (distribucion as unknown[]).length === 0 ? (
          <p className="text-xs text-secundario">Sin excepciones de tipo ausencia en el periodo</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {(distribucion as Array<{ motivo_categoria: string; total: number }>).map((row) => (
              <div key={row.motivo_categoria} className="border border-borde rounded px-4 py-2 text-center">
                <div className="text-lg font-bold text-primario">{row.total}</div>
                <div className="text-xs text-secundario capitalize">{row.motivo_categoria.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
