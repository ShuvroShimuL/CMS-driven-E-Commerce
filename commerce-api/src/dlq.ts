import { pool } from './db';

export type DLQEventType =
  | 'product_sync'       // Strapi → commerce_inventory upsert failed
  | 'steadfast_parcel'   // Steadfast parcel creation failed
  | 'strapi_order_patch' // Failed to write tracking_code back to Strapi;

/**
 * Write a failed event to the Dead-Letter Queue.
 * Safe to call fire-and-forget — errors are swallowed so the DLQ never
 * breaks the primary request flow.
 */
export async function writeToDLQ(
  eventType: DLQEventType,
  payload: Record<string, any>,
  errorMessage: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO commerce_dlq (event_type, payload, error_message)
       VALUES ($1, $2, $3)`,
      [eventType, JSON.stringify(payload), errorMessage]
    );
    console.warn(`[DLQ] Event queued: ${eventType} — ${errorMessage}`);
  } catch (dlqErr: any) {
    // Last-resort: if DLQ itself fails, log and move on — never crash the server
    console.error('[DLQ] Failed to write to DLQ:', dlqErr.message);
  }
}

/**
 * Mark a DLQ entry as resolved (manual or automated retry succeeded).
 */
export async function resolveDLQEntry(id: number): Promise<void> {
  await pool.query(
    `UPDATE commerce_dlq SET resolved = TRUE WHERE id = $1`,
    [id]
  );
}
