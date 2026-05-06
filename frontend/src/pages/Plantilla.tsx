import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personasApi, plazasApi } from '../api/client';
import type { Persona, Plaza, Subarea } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const SUBAREAS: Subarea[] = ['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes'];
const LABEL_SUBAREA: Record<Subarea, string> = {
  limpieza: 'Limpieza',
  jardineria: 'Jardinería',
  lavanderia: 'Lavandería',
  apoyo_logistico: 'Apoyo Logístico',
  areas_comunes: 'Áreas Comunes',
};

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

// ——— Modal editar persona ———
interface ModalPersonaProps {
  persona: Persona;
  onClose: () => void;
  onSave: (data: Partial<Persona>) => void;
  saving: boolean;
  error: string | null;
}
function ModalPersona({ persona, onClose, onSave, saving, error }: ModalPersonaProps) {
  const [form, setForm] = useState({
    nombre: persona.nombre,
    subarea: persona.subarea,
    tipo_contrato: persona.tipo_contrato,
    estado: persona.estado,
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded border border-borde shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 className="font-medium text-primario mb-4">Editar persona — {persona.codigo_empleado}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secundario block mb-1">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            />
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Subárea</label>
            <select
              value={form.subarea}
              onChange={(e) => setForm({ ...form, subarea: e.target.value as Subarea })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            >
              {SUBAREAS.map((s) => <option key={s} value={s}>{LABEL_SUBAREA[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Tipo contrato</label>
            <select
              value={form.tipo_contrato}
              onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value as 'permanente' | 'temporal' })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            >
              <option value="permanente">Permanente</option>
              <option value="temporal">Temporal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as Persona['estado'] })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            >
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => onSave(form)} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Modal editar plaza ———
interface ModalPlazaProps {
  plaza: Plaza;
  personas: Persona[];
  onClose: () => void;
  onSave: (data: Partial<Plaza>) => void;
  saving: boolean;
  error: string | null;
}
function ModalPlaza({ plaza, personas, onClose, onSave, saving, error }: ModalPlazaProps) {
  const [form, setForm] = useState({
    estado: plaza.estado,
    persona_id: plaza.persona_id ?? '',
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded border border-borde shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 className="font-medium text-primario mb-4">Editar plaza — {plaza.codigo_plaza}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secundario block mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as Plaza['estado'] })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            >
              <option value="autorizada">Autorizada</option>
              <option value="contratada">Contratada</option>
              <option value="vacante">Vacante</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-secundario block mb-1">Persona asignada</label>
            <select
              value={form.persona_id}
              onChange={(e) => setForm({ ...form, persona_id: e.target.value })}
              className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
            >
              <option value="">— Sin asignar —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({LABEL_SUBAREA[p.subarea]})</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onSave({
                estado: form.estado,
                persona_id: form.persona_id ? Number(form.persona_id) : null,
              })}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Formulario agregar persona ———
const PERSONA_VACIA = { codigo_empleado: '', nombre: '', subarea: 'limpieza' as Subarea, fecha_ingreso: '', tipo_contrato: 'permanente' as 'permanente' | 'temporal' };

interface FormAgregarPersonaProps {
  onSave: (data: typeof PERSONA_VACIA) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}
function FormAgregarPersona({ onSave, onCancel, saving, error }: FormAgregarPersonaProps) {
  const [form, setForm] = useState(PERSONA_VACIA);
  return (
    <div className="bg-white border border-borde rounded p-5 shadow-sm">
      <h2 className="text-sm font-medium text-primario mb-4">Nueva persona</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-secundario block mb-1">Código empleado</label>
          <input
            type="text"
            value={form.codigo_empleado}
            onChange={(e) => setForm({ ...form, codigo_empleado: e.target.value })}
            placeholder="EMP-001"
            className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
          />
        </div>
        <div>
          <label className="text-xs text-secundario block mb-1">Nombre completo</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="María García"
            className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
          />
        </div>
        <div>
          <label className="text-xs text-secundario block mb-1">Subárea</label>
          <select
            value={form.subarea}
            onChange={(e) => setForm({ ...form, subarea: e.target.value as Subarea })}
            className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
          >
            {SUBAREAS.map((s) => <option key={s} value={s}>{LABEL_SUBAREA[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-secundario block mb-1">Fecha ingreso</label>
          <input
            type="date"
            value={form.fecha_ingreso}
            onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
            className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
          />
        </div>
        <div>
          <label className="text-xs text-secundario block mb-1">Tipo contrato</label>
          <select
            value={form.tipo_contrato}
            onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value as 'permanente' | 'temporal' })}
            className="w-full border border-borde rounded px-3 py-2 text-sm focus:outline-none focus:border-primario"
          >
            <option value="permanente">Permanente</option>
            <option value="temporal">Temporal</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving}>
          {saving ? 'Guardando...' : 'Agregar persona'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ——— Página principal ———
export default function Plantilla() {
  const [pestana, setPestana] = useState<Pestana>('personas');
  const [sucursalFiltro, setSucursalFiltro] = useState<string>('');
  const puedeEditar = useRequireRole(['admin', 'jefatura']);
  const qc = useQueryClient();

  const [mostrarFormPersona, setMostrarFormPersona] = useState(false);
  const [editandoPersona, setEditandoPersona] = useState<Persona | null>(null);
  const [editandoPlaza, setEditandoPlaza] = useState<Plaza | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const { data: personas = [], isLoading: loadingP } = useQuery<Persona[]>({
    queryKey: ['personas'],
    queryFn: personasApi.listar,
  });

  const { data: plazas = [], isLoading: loadingPl } = useQuery<Plaza[]>({
    queryKey: ['plazas'],
    queryFn: plazasApi.listar,
  });

  const crearPersona = useMutation({
    mutationFn: personasApi.crear,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['personas'] }); setMostrarFormPersona(false); },
    onError: (e: Error) => setErrorModal(e.message),
  });

  const actualizarPersona = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Persona> }) => personasApi.actualizar(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['personas'] }); setEditandoPersona(null); setErrorModal(null); },
    onError: (e: Error) => setErrorModal(e.message),
  });

  const bajaPersona = useMutation({
    mutationFn: ({ id, fecha_baja }: { id: number; fecha_baja: string }) =>
      personasApi.baja(id, { fecha_baja, motivo_categoria: 'otro' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['personas'] }),
  });

  const actualizarPlaza = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Plaza> }) => plazasApi.actualizar(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['plazas'] }); setEditandoPlaza(null); setErrorModal(null); },
    onError: (e: Error) => setErrorModal(e.message),
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
        <div className="flex items-center gap-4">
          <span className="text-xs text-secundario">
            {personasFiltradas.length} personas · {plazas.length} plazas
          </span>
          {puedeEditar && pestana === 'personas' && (
            <Button size="sm" onClick={() => { setMostrarFormPersona(true); setErrorModal(null); }}>
              + Agregar persona
            </Button>
          )}
        </div>
      </div>

      {/* Formulario nueva persona */}
      {mostrarFormPersona && (
        <FormAgregarPersona
          onSave={(data) => { setErrorModal(null); crearPersona.mutate(data); }}
          onCancel={() => { setMostrarFormPersona(false); setErrorModal(null); }}
          saving={crearPersona.isPending}
          error={crearPersona.isError ? (crearPersona.error as Error).message : null}
        />
      )}

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
            {p === 'personas' ? 'Personas' : 'Plazas'}
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
                  <td className="px-4 py-2">{LABEL_SUBAREA[p.subarea]}</td>
                  <td className="px-4 py-2 capitalize">{p.tipo_contrato}</td>
                  <td className="px-4 py-2 text-xs">{p.fecha_ingreso}</td>
                  <td className="px-4 py-2">{estadoBadge(p.estado)}</td>
                  {puedeEditar && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditandoPersona(p); setErrorModal(null); }}
                          className="text-xs text-primario hover:underline"
                        >
                          Editar
                        </button>
                        {p.estado === 'activo' && (
                          <button
                            onClick={() => {
                              const hoy = new Date().toISOString().slice(0, 10);
                              if (confirm(`¿Registrar baja de ${p.nombre}?`)) {
                                bajaPersona.mutate({ id: p.id, fecha_baja: hoy });
                              }
                            }}
                            className="text-xs text-danger hover:underline"
                          >
                            Baja
                          </button>
                        )}
                      </div>
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
                <th className="px-4 py-2 text-left">Turno</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Persona asignada</th>
                {puedeEditar && <th className="px-4 py-2 text-left">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {plazas.map((pl) => {
                const persona = pl.persona_id ? personas.find((p) => p.id === pl.persona_id) : null;
                return (
                  <tr key={pl.id}>
                    <td className="px-4 py-2 font-mono text-xs">{pl.codigo_plaza}</td>
                    <td className="px-4 py-2">{LABEL_SUBAREA[pl.subarea]}</td>
                    <td className="px-4 py-2">{pl.turno_base === 'D' ? 'Diurno' : 'Nocturno'}</td>
                    <td className="px-4 py-2">{estadoPlazaBadge(pl.estado)}</td>
                    <td className="px-4 py-2 text-xs text-secundario">
                      {persona ? persona.nombre : <span className="italic">Vacante</span>}
                    </td>
                    {puedeEditar && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => { setEditandoPlaza(pl); setErrorModal(null); }}
                          className="text-xs text-primario hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {plazas.length === 0 && (
            <p className="text-center text-secundario text-sm py-8">Sin plazas</p>
          )}
        </div>
      )}

      {/* Modal editar persona */}
      {editandoPersona && (
        <ModalPersona
          persona={editandoPersona}
          onClose={() => { setEditandoPersona(null); setErrorModal(null); }}
          onSave={(data) => actualizarPersona.mutate({ id: editandoPersona.id, data })}
          saving={actualizarPersona.isPending}
          error={errorModal}
        />
      )}

      {/* Modal editar plaza */}
      {editandoPlaza && (
        <ModalPlaza
          plaza={editandoPlaza}
          personas={personas}
          onClose={() => { setEditandoPlaza(null); setErrorModal(null); }}
          onSave={(data) => actualizarPlaza.mutate({ id: editandoPlaza.id, data })}
          saving={actualizarPlaza.isPending}
          error={errorModal}
        />
      )}
    </div>
  );
}
