import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personasApi, plazasApi, type Persona, type Plaza } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

function estadoBadge(estado: string) {
  if (estado === 'activo') return <Badge label="Activo" variant="success" />;
  if (estado === 'inactivo') return <Badge label="Inactivo" variant="danger" />;
  return <Badge label="Suspendido" variant="warning" />;
}

function estadoPlazaBadge(estado: string) {
  if (estado === 'contratada') return <Badge label="Contratada" variant="success" />;
  if (estado === 'vacante') return <Badge label="Vacante" variant="danger" />;
  return <Badge label="Autorizada" variant="neutral" />;
}

type Pestana = 'personas' | 'plazas';

function getSucursal(area: string) { return area.split(' - ')[0]; }

export default function Plantilla() {
  const [pestana, setPestana] = useState<Pestana>('personas');
  const [sucursalFiltro, setSucursalFiltro] = useState<string>('');
  const puedeEditar = useRequireRole(['admin', 'jefatura']);
  const qc = useQueryClient();

  const { data: personas, isLoading: loadingP } = useQuery<Persona[]>({
    queryKey: ['personas'],
    queryFn: personasApi.listar,
  });

  const { data: plazas, isLoading: loadingPl } = useQuery<Plaza[]>({
    queryKey: ['plazas'],
    queryFn: plazasApi.listar,
  });

  const bajaPersona = useMutation({
    mutationFn: ({ id, fecha_baja }: { id: number; fecha_baja: string }) =>
      personasApi.baja(id, { fecha_baja, motivo_categoria: 'otro' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['personas'] }),
  });

  const isLoading = pestana === 'personas' ? loadingP : loadingPl;

  const sucursales = [...new Set((personas ?? []).map((p) => getSucursal(p.area)).filter((s): s is string => !!s))].sort();
  const personasFiltradas = sucursalFiltro
    ? (personas ?? []).filter((p) => getSucursal(p.area) === sucursalFiltro)
    : (personas ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Plantilla</h1>
        <div className="text-xs text-secundario">
          {personasFiltradas.length ?? '—'} personas · {plazas?.length ?? '—'} plazas
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

      {/* Pestañas */}
      <div className="flex gap-0 border-b border-borde">
        {(['personas', 'plazas'] as Pestana[]).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              pestana === p
                ? 'border-primario text-primario'
                : 'border-transparent text-secundario hover:text-primario'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-secundario text-sm">Cargando...</div>}

      {/* Tabla Personas */}
      {pestana === 'personas' && !isLoading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabla-institucional">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Área / Sección</th>
                <th className="px-4 py-2 text-left">Subárea</th>
                <th className="px-4 py-2 text-left">Contrato</th>
                <th className="px-4 py-2 text-left">Ingreso</th>
                <th className="px-4 py-2 text-left">Estado</th>
                {puedeEditar && <th className="px-4 py-2 text-left">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {personasFiltradas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs">{p.codigo_empleado}</td>
                  <td className="px-4 py-2">{p.nombre}</td>
                  <td className="px-4 py-2 text-xs text-secundario">{p.area}</td>
                  <td className="px-4 py-2 capitalize">{p.subarea.replace('_', ' ')}</td>
                  <td className="px-4 py-2 capitalize">{p.tipo_contrato}</td>
                  <td className="px-4 py-2 text-xs">{p.fecha_ingreso}</td>
                  <td className="px-4 py-2">{estadoBadge(p.estado)}</td>
                  {puedeEditar && (
                    <td className="px-4 py-2">
                      {p.estado === 'activo' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            const hoy = new Date().toISOString().slice(0, 10);
                            if (confirm(`¿Registrar baja de ${p.nombre}?`)) {
                              bajaPersona.mutate({ id: p.id, fecha_baja: hoy });
                            }
                          }}
                        >
                          Baja
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {personasFiltradas.length === 0 && (
            <p className="text-center text-secundario text-sm py-8">Sin personas activas</p>
          )}
        </div>
      )}

      {/* Tabla Plazas */}
      {pestana === 'plazas' && !isLoading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabla-institucional">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Subárea</th>
                <th className="px-4 py-2 text-left">Turno base</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Persona asignada</th>
              </tr>
            </thead>
            <tbody>
              {(plazas as Plaza[] | undefined ?? []).map((pl) => (
                <tr key={pl.id}>
                  <td className="px-4 py-2 font-mono text-xs">{pl.codigo_plaza}</td>
                  <td className="px-4 py-2 capitalize">{pl.subarea.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{pl.turno_base === 'D' ? 'Diurno' : 'Nocturno'}</td>
                  <td className="px-4 py-2">{estadoPlazaBadge(pl.estado)}</td>
                  <td className="px-4 py-2 text-xs text-secundario">{pl.persona_id ?? 'Vacante'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(plazas as Plaza[] | undefined ?? []).length === 0 && (
            <p className="text-center text-secundario text-sm py-8">Sin plazas</p>
          )}
        </div>
      )}
    </div>
  );
}
