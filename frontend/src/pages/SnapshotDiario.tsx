import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { asistenciaApi, type AsistenciaDiaria } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

function estadoLabel(estado: string) {
  const map: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }> = {
    presente: { label: 'Presente', variant: 'success' },
    ausente_justificado: { label: 'Ausente J.', variant: 'warning' },
    ausente_injustificado: { label: 'Ausente I.', variant: 'danger' },
    sustitucion: { label: 'Sustitución', variant: 'warning' },
    doble_turno: { label: 'Doble turno', variant: 'neutral' },
    permiso: { label: 'Permiso', variant: 'neutral' },
    incapacidad: { label: 'Incapacidad', variant: 'warning' },
    vacaciones: { label: 'Vacaciones', variant: 'neutral' },
  };
  const def = map[estado] ?? { label: estado, variant: 'neutral' as const };
  return <Badge label={def.label} variant={def.variant} />;
}

function diaSiguiente(fecha: string) {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function diaAnterior(fecha: string) {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function SnapshotDiario() {
  const { fecha } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fechaActual = fecha ?? new Date().toISOString().slice(0, 10);
  const puedeEditar = useRequireRole(['admin', 'jefatura', 'supervisor']);
  const puedeCerrar = useRequireRole(['admin', 'jefatura']);

  const { data: asistencias, isLoading, error } = useQuery<AsistenciaDiaria[]>({
    queryKey: ['asistencia', fechaActual],
    queryFn: () => asistenciaApi.obtener(fechaActual),
  });

  const cerrarDia = useMutation({
    mutationFn: () => asistenciaApi.cerrarDia(fechaActual),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asistencia', fechaActual] }),
  });

  const diaCerrado = (asistencias ?? []).every((a) => a.cerrado === 1) && (asistencias ?? []).length > 0;
  const totalHoras = (asistencias ?? []).reduce((acc, a) => acc + a.horas_trabajadas, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Snapshot Diario</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/asistencia/${diaAnterior(fechaActual)}`)}>
            &lsaquo; Anterior
          </Button>
          <span className="text-sm font-medium px-2">{fechaActual}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/asistencia/${diaSiguiente(fechaActual)}`)}>
            Siguiente &rsaquo;
          </Button>
        </div>
      </div>

      {/* Estado del día */}
      <div className="flex items-center gap-3">
        <Badge
          label={diaCerrado ? 'Cerrado' : 'Abierto'}
          variant={diaCerrado ? 'success' : 'warning'}
        />
        <span className="text-xs text-secundario">
          {asistencias?.length ?? 0} registros · {totalHoras.toFixed(1)} h totales
        </span>
        {puedeCerrar && !diaCerrado && (asistencias ?? []).length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (confirm(`¿Cerrar el día ${fechaActual}? Esta acción no se puede deshacer.`)) {
                cerrarDia.mutate();
              }
            }}
            disabled={cerrarDia.isPending}
          >
            {cerrarDia.isPending ? 'Cerrando...' : 'Cerrar día'}
          </Button>
        )}
      </div>

      {isLoading && <div className="text-secundario text-sm">Cargando...</div>}
      {error && <div className="text-danger text-sm">Error al cargar asistencia</div>}

      {!isLoading && (asistencias ?? []).length === 0 && (
        <div className="border border-borde rounded p-8 text-center">
          <p className="text-secundario text-sm">Sin registros para {fechaActual}</p>
          {puedeEditar && (
            <p className="text-xs text-secundario mt-2">El registro se crea al ingresar asistencia por primera vez</p>
          )}
        </div>
      )}

      {/* Tabla */}
      {!isLoading && (asistencias ?? []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabla-institucional">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Persona</th>
                <th className="px-4 py-2 text-center">Turno plan</th>
                <th className="px-4 py-2 text-center">Turno real</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Entrada</th>
                <th className="px-4 py-2 text-right">Salida</th>
                <th className="px-4 py-2 text-right">Horas</th>
                <th className="px-4 py-2 text-center">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {(asistencias ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2">ID {a.persona_id}</td>
                  <td className="px-4 py-2 text-center">{a.turno_planificado}</td>
                  <td className="px-4 py-2 text-center">{a.turno_real}</td>
                  <td className="px-4 py-2">{estadoLabel(a.estado)}</td>
                  <td className="px-4 py-2 text-right text-xs">{a.hora_entrada ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-xs">{a.hora_salida ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{a.horas_trabajadas.toFixed(1)}</td>
                  <td className="px-4 py-2 text-center">
                    {a.cerrado === 1
                      ? <Badge label="Cerrado" variant="success" />
                      : <Badge label="Abierto" variant="neutral" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
