import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/client';
import type { Rol, Usuario } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const etiquetaRol: Record<Rol, string> = {
  admin: 'Administrador',
  jefatura: 'Jefatura',
  supervisor: 'Supervisor',
  lectura: 'Solo lectura',
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';
const variantRol: Record<Rol, BadgeVariant> = {
  admin: 'danger',
  jefatura: 'success',
  supervisor: 'warning',
  lectura: 'neutral',
};

const rolesDisponibles: Rol[] = ['admin', 'jefatura', 'supervisor', 'lectura'];

interface FormNuevo {
  email: string;
  nombre: string;
  rol: Rol;
}

const formVacio: FormNuevo = { email: '', nombre: '', rol: 'supervisor' };

export default function Usuarios() {
  const qc = useQueryClient();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<FormNuevo>(formVacio);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [confirmDesactivar, setConfirmDesactivar] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: authApi.listarUsuarios,
  });

  const crearMutation = useMutation({
    mutationFn: authApi.crearUsuario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setMostrarForm(false);
      setForm(formVacio);
      setErrorForm(null);
    },
    onError: (e: Error) => setErrorForm(e.message),
  });

  const desactivarMutation = useMutation({
    mutationFn: (email: string) => authApi.desactivarUsuario(email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setConfirmDesactivar(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    crearMutation.mutate(form);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primario">Usuarios del sistema</h1>
          <p className="text-xs text-secundario mt-0.5">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} activo{usuarios.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => { setMostrarForm(true); setErrorForm(null); }}>
          + Agregar usuario
        </Button>
      </div>

      {/* Formulario nuevo usuario */}
      {mostrarForm && (
        <div className="bg-white border border-borde rounded p-5 shadow-sm">
          <h2 className="text-sm font-medium text-primario mb-4">Nuevo usuario</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secundario block mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Lic. Juan Pérez"
                  className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
                />
              </div>
              <div>
                <label className="text-xs text-secundario block mb-1">Correo institucional</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@avante.com.sv"
                  className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-secundario block mb-1">Rol</label>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
              >
                {rolesDisponibles.map((r) => (
                  <option key={r} value={r}>{etiquetaRol[r]}</option>
                ))}
              </select>
            </div>
            {errorForm && <p className="text-xs text-danger">{errorForm}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={crearMutation.isPending}>
                {crearMutation.isPending ? 'Guardando...' : 'Crear usuario'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { setMostrarForm(false); setForm(formVacio); setErrorForm(null); }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="bg-white border border-borde rounded shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-secundario">Cargando...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-sm text-secundario">No hay usuarios registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde bg-bg-alt text-xs text-secundario uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Último acceso</th>
                <th className="px-4 py-3 text-left">Miembro desde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {usuarios.map((u) => (
                <tr key={u.email} className="hover:bg-bg-alt/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-primario">{u.nombre}</td>
                  <td className="px-4 py-3 text-secundario">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge label={etiquetaRol[u.rol]} variant={variantRol[u.rol]} />
                  </td>
                  <td className="px-4 py-3 text-secundario">
                    {u.ultimo_acceso
                      ? new Date(u.ultimo_acceso).toLocaleDateString('es-SV')
                      : <span className="text-xs italic">Nunca</span>}
                  </td>
                  <td className="px-4 py-3 text-secundario">
                    {new Date(u.created_at).toLocaleDateString('es-SV')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmDesactivar(u)}
                      className="text-xs text-danger hover:underline"
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal confirmación desactivar */}
      {confirmDesactivar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded border border-borde shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-medium text-primario mb-2">Desactivar usuario</h3>
            <p className="text-sm text-secundario mb-4">
              ¿Desactivar a <span className="font-medium text-primario">{confirmDesactivar.nombre}</span>?
              No podrá iniciar sesión hasta ser reactivado.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => desactivarMutation.mutate(confirmDesactivar.email)}
                disabled={desactivarMutation.isPending}
              >
                {desactivarMutation.isPending ? 'Desactivando...' : 'Confirmar'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDesactivar(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
