import type { Excepcion, ClasificacionHE } from '../types';

export interface ResumenHE {
  total: number;
  planificadas: number;
  por_fallo_cobertura: number;
  por_demanda: number;
  porcentaje_fallo: number;
}

// Agrega horas extra por clasificación para un rango de excepciones ya cargadas.
// Función pura.
export function resumirHorasExtra(excepciones: Excepcion[]): ResumenHE {
  const conHE = excepciones.filter((e) => e.horas_extra_generadas > 0);

  const sumar = (tipo: ClasificacionHE): number =>
    conHE
      .filter((e) => e.clasificacion_he === tipo)
      .reduce((acc, e) => acc + e.horas_extra_generadas, 0);

  const total = conHE.reduce((acc, e) => acc + e.horas_extra_generadas, 0);
  const planificadas = sumar('planificada');
  const por_fallo_cobertura = sumar('por_fallo_cobertura');
  const por_demanda = sumar('por_demanda');

  return {
    total,
    planificadas,
    por_fallo_cobertura,
    por_demanda,
    porcentaje_fallo: total > 0 ? (por_fallo_cobertura / total) * 100 : 0,
  };
}

// Valida que toda excepción con horas extra tenga clasificación.
// Retorna los ids de excepciones inválidas.
export function validarClasificacionHE(excepciones: Excepcion[]): number[] {
  return excepciones
    .filter((e) => e.horas_extra_generadas > 0 && e.clasificacion_he === null)
    .map((e) => e.id);
}
