import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { excepcionesApi, type Excepcion } from '../api/client';
import { useRequireRole } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const formSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  persona_afectada_id: z.coerce.number().int().positive(),
  tipo: z.enum(['ausencia', 'sustitucion', 'doble_turno', 'cambio_area', 'cambio_turno']),
  motivo_categoria: z.enum(['enfermedad', 'permiso_personal', 'falta_relevo', 'emergencia_operativa', 'vacaciones', 'otro']),
  motivo_detalle: z.string().max(200).optional(),
  persona_sustituta_id: z.coerce.number().int().positive().optional(),
  horas_extra_generadas: z.coerce.number().min(0).default(0),
  clasificacion_he: z.enum(['planificada', 'por_fallo_cobertura', 'por_demanda']).optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Excepciones() {
  const [showForm, setShowForm] = useState(false);
  const puedeRegistrar = useRequireRole(['admin', 'jefatura', 'supervisor']);
  const qc = useQueryClient();

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = hoy.slice(0, 7) + '-01';

  const { data: excepciones, isLoading } = useQuery<Excepcion[]>({
    queryKey: ['excepciones', inicioMes, hoy],
    queryFn: () => excepcionesApi.listar(inicioMes, hoy),
  });

  const crear = useMutation({
    mutationFn: (data: FormData) =>
      excepcionesApi.crear({
        ...data,
        motivo_detalle: data.motivo_detalle ?? null,
        persona_sustituta_id: data.persona_sustituta_id ?? null,
        clasificacion_he: data.clasificacion_he ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['excepciones'] });
      setShowForm(false);
    },
  });

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { fecha: hoy, horas_extra_generadas: 0 },
  });

  const horasExtra = watch('horas_extra_generadas');

  const tipoLabel: Record<string, string> = {
    ausencia: 'Ausencia',
    sustitucion: 'Sustitución',
    doble_turno: 'Doble turno',
    cambio_area: 'Cambio de área',
    cambio_turno: 'Cambio de turno',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primario">Excepciones</h1>
        {puedeRegistrar && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Nueva excepción'}
          </Button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <form
          onSubmit={handleSubmit((d) => crear.mutate(d))}
          className="border border-borde rounded p-4 space-y-3 bg-bg-alt"
        >
          <h2 className="text-sm font-semibold">Registrar excepción</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-secundario">Fecha</label>
              <input
                type="date"
                {...register('fecha')}
                className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5"
              />
              {errors.fecha && <p className="text-xs text-danger mt-0.5">{errors.fecha.message}</p>}
            </div>
            <div>
              <label className="text-xs text-secundario">ID Persona afectada</label>
              <input
                type="number"
                {...register('persona_afectada_id')}
                className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5"
              />
              {errors.persona_afectada_id && <p className="text-xs text-danger mt-0.5">{errors.persona_afectada_id.message}</p>}
            </div>
            <div>
              <label className="text-xs text-secundario">Tipo</label>
              <select {...register('tipo')} className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5">
                <option value="">Seleccionar...</option>
                {Object.entries(tipoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-secundario">Motivo</label>
              <select {...register('motivo_categoria')} className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5">
                <option value="">Seleccionar...</option>
                <option value="enfermedad">Enfermedad</option>
                <option value="permiso_personal">Permiso personal</option>
                <option value="falta_relevo">Falta de relevo</option>
                <option value="emergencia_operativa">Emergencia operativa</option>
                <option value="vacaciones">Vacaciones</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-secundario">Horas extra generadas</label>
              <input
                type="number"
                step="0.5"
                min="0"
                {...register('horas_extra_generadas')}
                className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5"
              />
            </div>
            {Number(horasExtra) > 0 && (
              <div>
                <label className="text-xs text-secundario">Clasificación HE</label>
                <select {...register('clasificacion_he')} className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5">
                  <option value="">Seleccionar...</option>
                  <option value="planificada">Planificada</option>
                  <option value="por_fallo_cobertura">Por fallo de cobertura</option>
                  <option value="por_demanda">Por demanda</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-secundario">Detalle (máx 200 caracteres, sin datos médicos)</label>
            <input
              type="text"
              maxLength={200}
              {...register('motivo_detalle')}
              className="w-full border border-borde rounded px-2 py-1.5 text-sm mt-0.5"
            />
          </div>
          {crear.error && (
            <p className="text-xs text-danger">{(crear.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Lista */}
      {isLoading && <div className="text-secundario text-sm">Cargando...</div>}

      {!isLoading && (excepciones ?? []).length === 0 && (
        <div className="border border-borde rounded p-8 text-center">
          <p className="text-secundario text-sm">Sin excepciones en el periodo</p>
        </div>
      )}

      {!isLoading && (excepciones ?? []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabla-institucional">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Persona</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Motivo</th>
                <th className="px-4 py-2 text-right">HE</th>
                <th className="px-4 py-2 text-left">Clasificación HE</th>
                <th className="px-4 py-2 text-left">Autorizado por</th>
              </tr>
            </thead>
            <tbody>
              {(excepciones ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-xs">{e.fecha}</td>
                  <td className="px-4 py-2">ID {e.persona_afectada_id}</td>
                  <td className="px-4 py-2">{tipoLabel[e.tipo] ?? e.tipo}</td>
                  <td className="px-4 py-2 capitalize">{e.motivo_categoria.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-right">
                    {e.horas_extra_generadas > 0
                      ? <Badge label={`${e.horas_extra_generadas} h`} variant="warning" />
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">{e.clasificacion_he?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-secundario">{e.autorizado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
