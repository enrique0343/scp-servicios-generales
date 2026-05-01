import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import { getCoberturaVigente } from '../db/queries';
import { withAudit } from '../middleware/audit';
import { adminOJefatura, todosLosRoles } from '../middleware/rbac';

type Variables = { user: AuthUser };

const cobertura = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const reglaSchema = z.object({
  subarea: z.enum(['limpieza', 'jardineria', 'lavanderia', 'apoyo_logistico', 'areas_comunes']),
  turno: z.enum(['D', 'N']),
  dia_tipo: z.enum(['laboral', 'sabado', 'domingo', 'feriado']),
  personas_minimas: z.number().int().min(0),
  vigencia_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const putCoberturaSchema = z.object({
  reglas: z.array(reglaSchema).min(1),
  aprobado_por: z.string().min(2),
});

// GET /cobertura — estándar vigente
cobertura.get('/', todosLosRoles, async (c) => {
  const vigente = await getCoberturaVigente(c.env.DB);
  return c.json({ data: vigente });
});

// PUT /cobertura — reemplaza estándar (cierra vigencia anterior, crea nuevo)
cobertura.put('/', adminOJefatura, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = putCoberturaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');
  const hoy = new Date().toISOString().slice(0, 10);

  await withAudit(c.env.DB, user.email, 'cobertura_estandar', 0, 'UPDATE', null, async () => {
    // Cierra la vigencia de todos los registros activos
    await c.env.DB.prepare(
      `UPDATE cobertura_estandar SET vigencia_hasta = ? WHERE vigencia_hasta IS NULL`
    ).bind(hoy).run();

    // Inserta nuevo estándar
    for (const regla of parsed.data.reglas) {
      await c.env.DB.prepare(
        `INSERT INTO cobertura_estandar (subarea, turno, dia_tipo, personas_minimas, vigencia_desde, aprobado_por)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          regla.subarea,
          regla.turno,
          regla.dia_tipo,
          regla.personas_minimas,
          regla.vigencia_desde,
          parsed.data.aprobado_por
        )
        .run();
    }

    return { ok: true };
  });

  return c.json({ data: { mensaje: 'Cobertura estándar actualizada' } });
});

export default cobertura;
