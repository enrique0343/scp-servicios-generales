import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, AuthUser } from '../types';
import { getUsuarioByEmail, createUsuario } from '../db/queries';
import { sessions } from '../middleware/auth';
import { soloAdmin } from '../middleware/rbac';

type Variables = { user: AuthUser };

const auth = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

// OTPs pendientes: email → { code, expires }
const otpStore = new Map<string, { code: string; expires: number }>();

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// POST /auth/login — solicitar OTP
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email inválido' } }, 400);
  }

  const { email } = parsed.data;

  // Verificar que el usuario existe en D1
  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    // Responder igual que si existe para no revelar emails válidos
    return c.json({ data: { mensaje: 'Si el email está registrado, recibirás un código' } });
  }

  // Generar OTP válido por 10 minutos
  const code = randomCode();
  otpStore.set(email, { code, expires: Date.now() + 10 * 60 * 1000 });

  // Enviar email con Resend
  const resendKey = (c.env as AppEnv & { RESEND_API_KEY?: string }).RESEND_API_KEY;

  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SCP Avante <noreply@avantescp.com>',
        to: [email],
        subject: 'Código de acceso SCP',
        html: `
          <p>Tu código de acceso para el Sistema de Control de Personal es:</p>
          <h2 style="font-size:32px;letter-spacing:8px;font-family:monospace">${code}</h2>
          <p>Válido por 10 minutos. Si no solicitaste este código, ignora este mensaje.</p>
        `,
      }),
    });
  } else {
    // En desarrollo sin Resend: log del código
    console.log(`[DEV OTP] ${email}: ${code}`);
  }

  return c.json({ data: { mensaje: 'Si el email está registrado, recibirás un código' } });
});

// POST /auth/verify — verificar OTP y crear sesión
auth.post('/verify', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }).safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' } }, 400);
  }

  const { email, code } = parsed.data;
  const stored = otpStore.get(email);

  if (!stored || stored.code !== code || stored.expires < Date.now()) {
    return c.json({ error: { code: 'INVALID_OTP', message: 'Código inválido o expirado' } }, 401);
  }

  otpStore.delete(email);

  // Crear sesión
  const token = randomToken();
  sessions.set(token, email);

  // Expirar sesión en 24h
  setTimeout(() => sessions.delete(token), 24 * 60 * 60 * 1000);

  return c.json({
    data: { token, mensaje: 'Sesión iniciada' },
  }, 200, {
    'Set-Cookie': `scp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
  });
});

// GET /auth/me — usuario actual
auth.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ data: user });
});

// POST /auth/logout
auth.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = cookieHeader.match(/scp_session=([^;]+)/);
  if (match?.[1]) sessions.delete(match[1]);
  return c.json({ data: { mensaje: 'Sesión cerrada' } }, 200, {
    'Set-Cookie': 'scp_session=; Path=/; HttpOnly; Secure; Max-Age=0',
  });
});

// POST /auth/users — crear usuario (solo admin)
auth.post('/users', soloAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    email: z.string().email(),
    nombre: z.string().min(2).max(100),
    rol: z.enum(['admin', 'jefatura', 'supervisor', 'lectura']),
    persona_vinculada_id: z.number().int().positive().optional(),
  }).safeParse(body);

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

// DELETE /auth/users/:email
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
