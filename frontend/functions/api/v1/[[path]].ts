// Proxy transparente: reenvía /api/v1/* al Worker incluyendo cookies de Cloudflare Access

interface Env {
  WORKER_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = context.env.WORKER_URL ?? 'https://scp-api.enrique0343.workers.dev';
  const pathParam = context.params['path'];
  const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
  const targetUrl = `${workerUrl}/api/v1/${pathStr}${url.search}`;

  // Pasar todos los headers originales incluyendo Cookie (con CF_Authorization)
  const headers = new Headers(context.request.headers);

  // Eliminar headers que podrían causar conflictos
  headers.delete('host');

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
  });

  // Devolver respuesta del Worker tal cual
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
