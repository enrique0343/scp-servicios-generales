interface Env {
  WORKER_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = 'https://scp-api.enrique0343.workers.dev';

  // Reconstruir la URL destino manteniendo el path completo desde /api/v1/
  const targetUrl = workerUrl + url.pathname + url.search;

  const headers = new Headers(context.request.headers);
  headers.delete('host');

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
