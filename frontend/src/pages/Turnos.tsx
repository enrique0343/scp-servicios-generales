import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { turnosApi, type TurnoConfig } from '../api/client';
import { Button } from '../components/ui/Button';

const EMPTY: Omit<TurnoConfig, 'created_at'> = {
  codigo: '', nombre: '', hora_inicio: '06:00', hora_fin: '18:00',
  horas_duracion: 12, cruza_medianoche: 0, activo: 1,
};

export default function Turnos() {
  const qc = useQueryClient();
  const { data: turnos, isLoading } = useQuery<TurnoConfig[]>({
    queryKey: ['turnos'],
    queryFn: turnosApi.listar,
  });

  const [editando, setEditando] = useState<Omit<TurnoConfig, 'created_at'> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (t: Omit<TurnoConfig, 'created_at'>) => turnosApi.guardar(t),
    onSuccess: () => {
      setEditando(null);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ['turnos'] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  function abrirNuevo() {
    setEditando({ ...EMPTY });
    setErrorMsg(null);
  }

  function abrirEditar(t: TurnoConfig) {
    setEditando({ codigo: t.codigo, nombre: t.nombre, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, horas_duracion: t.horas_duracion, cruza_medianoche: t.cruza_medianoche, activo: t.activo });
    setErrorMsg(null);
  }

  function handleGuardar() {
    if (!editando) return;
    guardar.mutate(editando);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Configuración de Turnos</h1>
        <Button variant="primary" size="sm" onClick={abrirNuevo}>+ Nuevo turno</Button>
      </div>

      {isLoading && <div className="text-secundario text-sm">Cargando turnos...</div>}

      {/* Tabla de turnos */}
      {!isLoading && turnos && (
        <div className="border border-borde rounded overflow-hidden">
          <table className="w-full text-sm tabla-institucional">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-center">Entrada</th>
                <th className="px-4 py-2 text-center">Salida</th>
                <th className="px-4 py-2 text-center">Horas</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.codigo}>
                  <td className="px-4 py-2 font-bold font-mono">{t.codigo}</td>
                  <td className="px-4 py-2">{t.nombre}</td>
                  <td className="px-4 py-2 text-center font-mono">{t.hora_inicio}</td>
                  <td className="px-4 py-2 text-center font-mono">
                    {t.hora_fin}{t.cruza_medianoche ? ' +1' : ''}
                  </td>
                  <td className="px-4 py-2 text-center">{t.horas_duracion}h</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-primario hover:underline" onClick={() => abrirEditar(t)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario edición */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-primario">
              {turnos?.find(t => t.codigo === editando.codigo) ? 'Editar turno' : 'Nuevo turno'}
            </h2>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{errorMsg}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secundario mb-1">Código</label>
                <input
                  className="w-full border border-borde rounded px-3 py-1.5 text-sm font-mono uppercase"
                  value={editando.codigo}
                  onChange={e => setEditando({ ...editando, codigo: e.target.value.toUpperCase() })}
                  disabled={!!(turnos?.find(t => t.codigo === editando.codigo))}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs text-secundario mb-1">Nombre</label>
                <input
                  className="w-full border border-borde rounded px-3 py-1.5 text-sm"
                  value={editando.nombre}
                  onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-secundario mb-1">Hora entrada</label>
                <input
                  type="time"
                  className="w-full border border-borde rounded px-3 py-1.5 text-sm font-mono"
                  value={editando.hora_inicio}
                  onChange={e => setEditando({ ...editando, hora_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-secundario mb-1">Hora salida</label>
                <input
                  type="time"
                  className="w-full border border-borde rounded px-3 py-1.5 text-sm font-mono"
                  value={editando.hora_fin}
                  onChange={e => setEditando({ ...editando, hora_fin: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-secundario mb-1">Duración (horas)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  className="w-full border border-borde rounded px-3 py-1.5 text-sm"
                  value={editando.horas_duracion}
                  onChange={e => setEditando({ ...editando, horas_duracion: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.cruza_medianoche === 1}
                    onChange={e => setEditando({ ...editando, cruza_medianoche: e.target.checked ? 1 : 0 })}
                  />
                  Cruza medianoche
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.activo === 1}
                    onChange={e => setEditando({ ...editando, activo: e.target.checked ? 1 : 0 })}
                  />
                  Activo
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setEditando(null)} disabled={guardar.isPending}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleGuardar} disabled={guardar.isPending}>
                {guardar.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
