import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, AuthUser } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import plantillaRoutes from './routes/plantilla';
import plazasRoutes from './routes/plazas';
import planRoutes from './routes/plan';
import asistenciaRoutes from './routes/asistencia';
import excepcionesRoutes from './routes/excepciones';
import coberturaRoutes from './routes/cobertura';
import dashboardRoutes from './routes/dashboard';
import auditoriaRoutes from './routes/auditoria';

type Variables = { user: AuthUser };

const app = new Hono<{ Bindings: AppEnv; Variables: Variables }>();

// CORS — permite el dominio de Pages en producción y localhost en desarrollo
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (origin.includes('localhost') || origin.endsWith('.pages.dev') || origin.endsWith('avante.com.sv')) {
        return origin;
      }
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cf-Access-Jwt-Assertion', 'X-Dev-Email'],
  })
);

// Health check (sin auth)
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Autenticación global para todas las rutas /api/v1
app.use('/api/v1/*', authMiddleware);

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

// Handler global de errores — único punto que llama c.json con error estructurado
app.onError((err, c) => {
  console.error('[SCP Error]', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
      },
    },
    500
  );
});

// 404 para rutas no encontradas
app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }, 404)
);

export default app;
