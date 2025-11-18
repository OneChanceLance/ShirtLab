import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

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

type DesignAssetPayload = {
  cartItemId: string;
  url: string;
  bucket: string | null;
  stored: boolean;
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
  // Optional: raw designAssets list, logged for debugging only
  designAssets?: DesignAssetPayload[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[create-order-with-uploads] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
    return jsonResponse(
      { error: "Supabase is not configured for this function." },
      500,
    );
  }

  let payload: CreateOrderPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("[create-order-with-uploads] Failed to parse JSON body", error);
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "Missing order payload" }, 400);
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
    return jsonResponse(
      { error: "first_name, last_name, and email are required." },
      400,
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    console.log("[create-order-with-uploads] Inserting order", {
      email,
      itemsCount: items?.length ?? 0,
      designsCount: designs?.length ?? 0,
    });

    const { error } = await supabase.from("orders").insert([
      {
        first_name,
        last_name,
        company,
        phone,
        items: items && items.length ? items : null,
        designs: designs && designs.length ? designs : null,
        order_details,
        email,
        payment_status: typeof payment_status === "boolean" ? payment_status : true,
        order_total: order_total ?? null,
        status: status ?? "pending",
      },
    ]);

    if (error) {
      console.error("[create-order-with-uploads] Supabase insert failed", error);
      return jsonResponse(
        { error: "Failed to record order in Supabase." },
        500,
      );
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[create-order-with-uploads] Unexpected error", error);
    return jsonResponse(
      { error: "Unexpected error while recording order." },
      500,
    );
  }
});

