import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import type { AppEnv, AuthUser } from './types';
import { authMiddleware, sessions } from './middleware/auth';
import { getUsuarioByEmail, createUsuario } from './db/queries';
import plantillaRoutes from './routes/plantilla';
import plazasRoutes from './routes/plazas';
import planRoutes from './routes/plan';
import asistenciaRoutes from './routes/asistencia';
import excepcionesRoutes from './routes/excepciones';
import coberturaRoutes from './routes/cobertura';
import dashboardRoutes from './routes/dashboard';
import auditoriaRoutes from './routes/auditoria';
import authRoutes from './routes/auth';

type Variables = { user: AuthUser };

const app = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (origin.includes('localhost') || origin.endsWith('.pages.dev') || origin.endsWith('avante.com.sv')) {
      return origin;
    }
    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Dev-Email'],
}));

// Health (sin auth)
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// =============================================================
// Rutas públicas — SIN middleware de auth
// =============================================================

// OTPs en memoria: email → { code, expires }
const otpStore = new Map<string, { code: string; expires: number }>();

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

app.post('/api/v1/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email inválido' } }, 400);
  }
  const { email } = parsed.data;
  const usuario = await getUsuarioByEmail(c.env.DB, email);
  if (!usuario) {
    return c.json({ data: { mensaje: 'Si el email está registrado, recibirás un código' } });
  }
  const code = randomCode();
  otpStore.set(email, { code, expires: Date.now() + 10 * 60 * 1000 });

  const resendKey = (c.env as AppEnv & { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SCP Avante <onboarding@resend.dev>',
        to: [email],
        subject: 'Código de acceso SCP',
        html: `<p>Tu código de acceso es:</p><h2 style="font-size:32px;letter-spacing:8px;font-family:monospace">${code}</h2><p>Válido por 10 minutos.</p>`,
      }),
    });
  } else {
    console.log(`[DEV OTP] ${email}: ${code}`);
  }

  return c.json({ data: { mensaje: 'Si el email está registrado, recibirás un código' } });
});

app.post('/api/v1/auth/verify', async (c) => {
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
  const token = randomToken();
  sessions.set(token, email);
  setTimeout(() => sessions.delete(token), 24 * 60 * 60 * 1000);
  return c.json({ data: { token, mensaje: 'Sesión iniciada' } }, 200, {
    'Set-Cookie': `scp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
  });
});

// =============================================================
// Middleware de auth para todas las rutas protegidas
// =============================================================
app.use('/api/v1/*', authMiddleware);

// =============================================================
// Rutas protegidas
// =============================================================
const v1 = new Hono<{ Bindings: AppEnv; Variables: Variables }>();
v1.route('/auth', authRoutes);
v1.route('/personas', plantillaRoutes);
v1.route('/plazas', plazasRoutes);
v1.route('/plan', planRoutes);
v1.route('/asistencia', asistenciaRoutes);
v1.route('/excepciones', excepcionesRoutes);
v1.route('/cobertura', coberturaRoutes);
v1.route('/dashboard', dashboardRoutes);
v1.route('/auditoria', auditoriaRoutes);
app.route('/api/v1', v1);

app.onError((err, c) => {
  console.error('[SCP Error]', err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }, 500);
});

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }, 404)
);

export default app;
