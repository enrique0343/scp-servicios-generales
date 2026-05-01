import type { AsistenciaDiaria, Excepcion } from '../types';

export interface ResultadoCierre {
  puede_cerrar: boolean;
  motivos_bloqueo: string[];
}

// Valida que el día puede cerrarse: todas las desviaciones deben tener excepción registrada.
// Regla de negocio del README sección 5.2 punto 3.
// Función pura.
export function validarCierreDiario(
  asistencias: AsistenciaDiaria[],
  excepciones: Excepcion[],
  fecha: string
): ResultadoCierre {
  const motivos_bloqueo: string[] = [];

  const asistenciasDelDia = asistencias.filter((a) => a.fecha === fecha);
  const excepcionesDelDia = excepciones.filter((e) => e.fecha === fecha);

  for (const a of asistenciasDelDia) {
    const esDesviacion = [
      'ausente_justificado',
      'ausente_injustificado',
      'sustitucion',
      'doble_turno',
      'permiso',
      'incapacidad',
    ].includes(a.estado);

    if (!esDesviacion) continue;

    const tieneExcepcion = excepcionesDelDia.some(
      (e) => e.persona_afectada_id === a.persona_id
    );

    if (!tieneExcepcion) {
      motivos_bloqueo.push(
        `Persona ${a.persona_id} tiene estado '${a.estado}' sin excepción registrada`
      );
    }
  }

  return {
    puede_cerrar: motivos_bloqueo.length === 0,
    motivos_bloqueo,
  };
}
