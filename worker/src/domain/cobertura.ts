import type {
  PlanMensual,
  CoberturaEstandar,
  Plaza,
  Subarea,
  TurnoBase,
  DiaTipo,
  DeficitSubarea,
  DeficitReport,
  ValidationResult,
} from '../types';

// Determina el tipo de día según la fecha (placeholder: no tiene calendario de feriados)
// En producción se puede pasar un arreglo de feriados como parámetro adicional.
export function tipoDia(fecha: string, feriados: string[] = []): DiaTipo {
  if (feriados.includes(fecha)) return 'feriado';
  const dow = new Date(fecha).getUTCDay(); // 0=dom, 6=sab
  if (dow === 0) return 'domingo';
  if (dow === 6) return 'sabado';
  return 'laboral';
}

// Cuenta cuántas personas están planificadas por subárea y turno en una fecha dada.
function contarPlanificados(
  plan: PlanMensual[],
  fecha: string
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const linea of plan) {
    if (linea.fecha !== fecha) continue;
    if (linea.turno === 'descanso') continue;
    const key = `${linea.subarea_asignada}|${linea.turno}`;
    conteo.set(key, (conteo.get(key) ?? 0) + 1);
  }
  return conteo;
}

// Calcula el déficit de cobertura para una fecha concreta.
// Función pura: no accede a DB, solo opera sobre los datos ya cargados.
export function calcularDeficit(
  plan: PlanMensual[],
  cobertura: CoberturaEstandar[],
  fecha: string,
  feriados: string[] = []
): DeficitReport {
  const tipo = tipoDia(fecha, feriados);
  const planificados = contarPlanificados(plan, fecha);
  const coberturaFecha = cobertura.filter(
    (c) =>
      c.dia_tipo === tipo &&
      (c.vigencia_hasta === null || c.vigencia_hasta >= fecha) &&
      c.vigencia_desde <= fecha
  );

  const deficits: DeficitSubarea[] = [];

  for (const regla of coberturaFecha) {
    const key = `${regla.subarea}|${regla.turno}`;
    const planificadasCount = planificados.get(key) ?? 0;
    const deficit = regla.personas_minimas - planificadasCount;
    deficits.push({
      subarea: regla.subarea as Subarea,
      turno: regla.turno as TurnoBase,
      dia_tipo: regla.dia_tipo,
      personas_planificadas: planificadasCount,
      personas_minimas: regla.personas_minimas,
      deficit: Math.max(0, deficit),
    });
  }

  return {
    fecha,
    deficits,
    tiene_deficit: deficits.some((d) => d.deficit > 0),
  };
}

// Valida que el plan cubra todas las plazas activas en el mes dado.
// Retorna lista de errores descriptivos si hay incompleto.
export function validarPlanCompleto(
  plan: PlanMensual[],
  plazasActivas: Plaza[],
  yyyymm: string
): ValidationResult {
  const errores: string[] = [];

  // Determina cuántos días tiene el mes
  const [year, month] = yyyymm.split('-').map(Number);
  if (!year || !month) {
    return { valido: false, errores: ['Formato de mes inválido, usar YYYY-MM'] };
  }
  const diasDelMes = new Date(year, month, 0).getDate();

  for (const plaza of plazasActivas) {
    if (!plaza.persona_id) {
      errores.push(`Plaza ${plaza.codigo_plaza} no tiene persona asignada`);
      continue;
    }
    for (let d = 1; d <= diasDelMes; d++) {
      const fecha = `${yyyymm}-${String(d).padStart(2, '0')}`;
      const tieneLinea = plan.some(
        (p) => p.persona_id === plaza.persona_id && p.fecha === fecha
      );
      if (!tieneLinea) {
        errores.push(`Persona ${plaza.persona_id} (${plaza.codigo_plaza}) sin turno el ${fecha}`);
      }
    }
  }

  return { valido: errores.length === 0, errores };
}
