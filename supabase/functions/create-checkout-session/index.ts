import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe@14.0.0";

interface CheckoutLineItemRequest {
  id?: string | null;
  quantity?: number | null;
  unitAmount?: number | null;
  currency?: string | null;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface CheckoutCustomerRequest {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
}

interface CheckoutRequestPayload {
  lineItems?: CheckoutLineItemRequest[];
  customer?: CheckoutCustomerRequest | null;
  cartSummary?: {
    subtotal?: number | null;
    currency?: string | null;
    itemCount?: number | null;
    uniqueCount?: number | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  successUrl?: string | null;
  cancelUrl?: string | null;
  mode?: "checkout-session" | "payment-intent";
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const DEFAULT_SUCCESS_URL = Deno.env.get("CHECKOUT_SUCCESS_URL") ?? "http://localhost:5173/?checkout=success";
const DEFAULT_CANCEL_URL = Deno.env.get("CHECKOUT_CANCEL_URL") ?? "http://localhost:5173/?checkout=canceled";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    typescript: true,
  })
  : null;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function sanitizeString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeCurrency(value: unknown): string {
  if (typeof value === "string" && value.trim().length === 3) {
    return value.trim().toLowerCase();
  }
  return "usd";
}

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeMetadata(record: Record<string, unknown> | null | undefined): Stripe.Emptyable<Stripe.MetadataParam> {
  if (!record || typeof record !== "object") return {};
  const metadata: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof key !== "string" || !key) continue;
    if (rawValue === null || rawValue === undefined) continue;
    let value: string;
    if (typeof rawValue === "string") {
      value = rawValue;
    } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      value = String(rawValue);
    } else {
      try {
        value = JSON.stringify(rawValue);
      } catch {
        continue;
      }
    }
    metadata[key.slice(0, 40)] = value.slice(0, 500);
  }
  return metadata;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!stripe) {
    console.error("[Stripe] Missing STRIPE_SECRET_KEY environment variable.");
    return jsonResponse({ error: "Stripe is not configured." }, 500);
  }

  let payload: CheckoutRequestPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("[Stripe] Failed to parse request body:", error);
    return jsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const requestedItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of requestedItems) {
    const unitAmount = Number(item.unitAmount);
    const quantity = Number(item.quantity);

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      console.warn("[Stripe] Skipping item with invalid unit amount", item);
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn("[Stripe] Skipping item with invalid quantity", item);
      continue;
    }

    const name = sanitizeString(item.name, 120) ?? "Custom Apparel";
    const description = sanitizeString(item.description, 250);
    const image = isValidHttpUrl(item.image ?? undefined) ? item.image ?? undefined : undefined;
    const currency = sanitizeCurrency(item.currency);

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: Math.max(1, Math.floor(quantity)),
      price_data: {
        currency,
        unit_amount: Math.floor(unitAmount),
        product_data: {
          name,
          description,
          metadata: sanitizeMetadata({
            ...(item.metadata ?? {}),
            lineItemId: item.id ?? null,
          }),
        },
      },
    };

    if (image) {
      lineItem.price_data!.product_data!.images = [image];
    }

    lineItems.push(lineItem);
  }

  if (!lineItems.length) {
    return jsonResponse({ error: "No valid line items were provided." }, 400);
  }

  const successUrl = isValidHttpUrl(typeof payload.successUrl === "string" ? payload.successUrl : undefined)
    ? (payload.successUrl as string)
    : DEFAULT_SUCCESS_URL;
  const cancelUrl = isValidHttpUrl(typeof payload.cancelUrl === "string" ? payload.cancelUrl : undefined)
    ? (payload.cancelUrl as string)
    : DEFAULT_CANCEL_URL;

  const customer = payload.customer ?? {};
  const customerEmail = sanitizeString(customer.email, 255);

  const sessionMetadata = sanitizeMetadata({
    ...payload.metadata,
    customerName: customer.name ?? null,
    customerPhone: customer.phone ?? null,
    customerCompany: customer.company ?? null,
    customerNotes: customer.notes ?? null,
    cartSubtotal: payload.cartSummary?.subtotal ?? null,
    cartCurrency: payload.cartSummary?.currency ?? null,
    cartItemCount: payload.cartSummary?.itemCount ?? null,
    cartUniqueCount: payload.cartSummary?.uniqueCount ?? null,
  });

  const mode = payload.mode === "payment-intent" ? "payment-intent" : "checkout-session";

  if (mode === "payment-intent") {
    if (!lineItems.length) {
      return jsonResponse({ error: "No valid line items were provided." }, 400);
    }

    const firstCurrency = lineItems[0].price_data?.currency ?? "usd";
    const hasMixedCurrency = lineItems.some((item) => item.price_data?.currency !== firstCurrency);
    if (hasMixedCurrency) {
      return jsonResponse({ error: "All line items must use the same currency." }, 400);
    }

    let amount = 0;
    for (const item of lineItems) {
      const qty = Math.max(1, Math.floor(item.quantity ?? 1));
      const unitAmount = Math.floor(item.price_data?.unit_amount ?? 0);
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        continue;
      }
      amount += qty * unitAmount;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Unable to determine payment amount." }, 400);
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: firstCurrency,
        metadata: sessionMetadata,
        receipt_email: customerEmail,
        description: `ShirtLab checkout - ${lineItems.length} item(s)`,
        automatic_payment_methods: { enabled: true },
      });

      return jsonResponse({
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        amount,
        currency: firstCurrency,
      });
    } catch (error) {
      console.error("[Stripe] Failed to create PaymentIntent", error);
      return jsonResponse({ error: "Unable to start payment. Please try again." }, 500);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      customer_email: customerEmail,
      phone_number_collection: customer.phone ? { enabled: true } : undefined,
      customer_creation: "if_required",
      metadata: sessionMetadata,
    });

    return jsonResponse({
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error("[Stripe] Session creation failed:", error);
    const message = error instanceof Error ? error.message : "Stripe checkout session failed.";
    return jsonResponse({ error: message }, 500);
  }
});
