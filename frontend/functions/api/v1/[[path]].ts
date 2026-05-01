// Proxy transparente: reenvía todas las peticiones /api/v1/* al Worker
// Cloudflare Pages inyecta automáticamente Cf-Access-Jwt-Assertion en este contexto
// porque el frontend y las Functions comparten el mismo dominio de Access.

interface Env {
  WORKER_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = context.env.WORKER_URL ?? 'https://scp-api.enrique0343.workers.dev';

  // Construir URL destino manteniendo path y query params
  const targetUrl = `${workerUrl}/api/v1/${context.params['path'] as string ?? ''}${url.search}`;

  // Clonar headers originales y asegurarse que el JWT de Access viaje al Worker
  const headers = new Headers(context.request.headers);

  // Cloudflare Access inyecta CF_Authorization como cookie HttpOnly —
  // las Pages Functions sí pueden leerla del header Cookie y reenviarla como JWT
  const cfJwt = context.request.headers.get('Cf-Access-Jwt-Assertion');
  if (cfJwt) {
    headers.set('Cf-Access-Jwt-Assertion', cfJwt);
  } else {
    // Intentar extraer desde cookie (disponible en server-side)
    const cookieHeader = context.request.headers.get('Cookie') ?? '';
    const match = cookieHeader.match(/CF_Authorization=([^;]+)/);
    if (match?.[1]) {
      headers.set('Cf-Access-Jwt-Assertion', match[1]);
    }
  }

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
