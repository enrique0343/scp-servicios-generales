import type { AccionAuditoria } from '../types';
import { insertAuditoria } from '../db/queries';

// Helper explícito para auditar mutaciones. Los route handlers lo llaman directamente
// pasando la DB, el email del usuario, y la acción a realizar.
// Si fn() lanza, el log registra el intento fallido y re-lanza el error.
export async function withAudit<T>(
  db: D1Database,
  usuarioEmail: string,
  tabla: string,
  registroId: number,
  accion: AccionAuditoria,
  payloadAnterior: unknown,
  fn: () => Promise<T>
): Promise<T> {
  let resultado: T;
  let payloadNuevo: unknown;

  try {
    resultado = await fn();
    payloadNuevo = resultado;
  } catch (err) {
    // Registra intento fallido y re-lanza para que el handler retorne 500
    await insertAuditoria(db, {
      tabla,
      registro_id: registroId,
      accion,
      usuario_email: usuarioEmail,
      payload_anterior: payloadAnterior ? JSON.stringify(payloadAnterior) : null,
      payload_nuevo: null,
    }).catch(() => {
      // No silenciar el error original por fallo de auditoría secundaria
    });
    throw err;
  }

  await insertAuditoria(db, {
    tabla,
    registro_id: registroId,
    accion,
    usuario_email: usuarioEmail,
    payload_anterior: payloadAnterior ? JSON.stringify(payloadAnterior) : null,
    payload_nuevo: payloadNuevo ? JSON.stringify(payloadNuevo) : null,
  });

  return resultado;
}
