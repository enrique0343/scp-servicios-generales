import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, createUsuario } from '../db/queries';
import { soloAdmin } from '../middleware/rbac';

type Variables = { user: AuthUser };

const auth = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

const crearUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(100),
  rol: z.enum(['admin', 'jefatura', 'supervisor', 'lectura']),
  persona_vinculada_id: z.number().int().positive().optional(),
});

// GET /auth/me — retorna el usuario autenticado actual
auth.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ data: user });
});

// POST /auth/users — crea un usuario (solo admin)
auth.post('/users', soloAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = crearUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: parsed.error.flatten() } }, 400);
  }

  const existente = await getUsuarioByEmail(c.env.DB, parsed.data.email);
  if (existente) {
    return c.json({ error: { code: 'CONFLICT', message: 'El email ya está registrado' } }, 409);
  }

  await createUsuario(c.env.DB, {
    email: parsed.data.email,
    nombre: parsed.data.nombre,
    rol: parsed.data.rol,
    persona_vinculada_id: parsed.data.persona_vinculada_id ?? null,
    activo: 1,
  });

  return c.json({ data: { mensaje: 'Usuario creado' } }, 201);
});

// DELETE /auth/users/:email — desactiva un usuario (solo admin)
auth.delete('/users/:email', soloAdmin, async (c) => {
  const email = decodeURIComponent(c.req.param('email'));
  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } }, 404);
  }

  await c.env.DB.prepare(`UPDATE usuario SET activo = 0 WHERE email = ?`).bind(email).run();

  return c.json({ data: { mensaje: 'Usuario desactivado' } });
});

export default auth;
