// Example Firebase Cloud Function for SODTF project.
// This mirrors the payload used by CheckoutDrawer.recordOrderIfNeeded()
// and writes orders into Firestore instead of Supabase.

import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type OrderItemPayload = {
  cartItemId: string;
  shirt: Record<string, unknown> | null;
  color: Record<string, unknown> | null;
  size: string | null;
  quantity: number;
  minimumQuantity: number;
  front_design_with_shirt_url: string | null;
  front_design_without_shirt_url: string | null;
  back_design_with_shirt_url: string | null;
  back_design_without_shirt_url: string | null;
};

type DesignEntryPayload = {
  cartItemId: string;
  assets: Array<{ url: string; bucket: string | null; stored: boolean }> | null;
  elements: Array<Record<string, unknown>> | null;
};

interface CreateOrderPayload {
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string;
  email: string;
  order_details: string | null;
  order_total: number | null;
  payment_status?: boolean;
  status?: string;
  items: OrderItemPayload[] | null;
  designs: DesignEntryPayload[] | null;
}

export const createOrderWithUploads = onRequest(
  { cors: ['*'], region: 'us-central1' },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(200).send('ok');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const payload = req.body as CreateOrderPayload | undefined;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Missing order payload' });
      return;
    }

    const {
      first_name,
      last_name,
      company,
      phone,
      email,
      order_details,
      order_total,
      payment_status,
      status,
      items,
      designs,
    } = payload;

    if (!first_name || !last_name || !email) {
      res
        .status(400)
        .json({ error: 'first_name, last_name, and email are required.' });
      return;
    }

    try {
      const now = admin.firestore.FieldValue.serverTimestamp();
      await db.collection('orders').add({
        first_name,
        last_name,
        company,
        phone,
        items: items && items.length ? items : null,
        designs: designs && designs.length ? designs : null,
        order_details,
        email,
        payment_status: typeof payment_status === 'boolean' ? payment_status : true,
        order_total: order_total ?? null,
        status: status ?? 'pending',
        created_at: now,
        updated_at: now,
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[createOrderWithUploads] Firestore insert failed', error);
      res
        .status(500)
        .json({ error: 'Failed to record order in Firebase.' });
    }
  },
);

