/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const parsehubApiKey = Deno.env.get("PARSEHUB_API_KEY");
const parsehubProjectToken = Deno.env.get("PARSEHUB_PROJECT_TOKEN");
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("OK", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const { searchParams } = new URL(req.url);
    let productId = searchParams.get("productId");
    let url = searchParams.get("url") || null;

    let body = null;
    if (req.method === "POST") {
      try {
        body = await req.json();
        console.log("Parsed JSON body:", body);
        productId = productId || body?.productId || null;
        url = body?.url || url;
      } catch (err) {
        console.log("No JSON body or invalid JSON:", err);
      }
    }

    console.log("Scraping URL:", url);

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing URL" }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // ParseHub setup
    // NOTE: In your ParseHub selector expression, use `.split(/\s*-\s*/)` for robustness.
    // Example: $e.text.split(/\s*-\s*/)

    console.log("Triggering ParseHub run for URL:", url);

    // 1️⃣ Start a new ParseHub run with the dynamic URL
    const startRun = await fetch(`https://www.parsehub.com/api/v2/projects/${parsehubProjectToken}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `api_key=${encodeURIComponent(parsehubApiKey!)}&start_url=${encodeURIComponent(url)}`
    });

    const startText = await startRun.text();
    console.log("Start run raw response:", startText.slice(0, 200));

    let startData;
    try {
      startData = JSON.parse(startText);
    } catch (err) {
      return new Response(JSON.stringify({
        error: "ParseHub run response is not JSON",
        hint: "Check your API key and project token",
        raw: startText.slice(0, 500)
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    console.log("ParseHub run started:", startData);

    if (!startData.run_token) {
      return new Response(JSON.stringify({ error: "Failed to start ParseHub run", details: startData }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // 2️⃣ Poll until the run is finished
    const runToken = startData.run_token;
    let status = "running";
    let tries = 0;
    const maxTries = 500; // Effectively keep polling until complete or super high limit
    let lastReadyData = null;
    let savedColors: any[] = [];

    while (status !== "complete" && tries < maxTries) {
      console.log(`Polling run ${runToken} (try ${tries + 1})...`);

      // ✅ Always get run status
      const statusRes = await fetch(`https://www.parsehub.com/api/v2/runs/${runToken}?api_key=${parsehubApiKey}`);
      const statusData = await statusRes.json();
      status = statusData.status;
      console.log(`Current status: ${status}`);

      // ✅ Also get latest data if any
      const pollRes = await fetch(`https://www.parsehub.com/api/v2/runs/${runToken}/data?api_key=${parsehubApiKey}`);
      if (pollRes.status === 200) {
        try {
          const maybeData = await pollRes.json();
          if (maybeData && Object.keys(maybeData).length > 0) {
            lastReadyData = maybeData;

            if (Array.isArray(maybeData.colors) && maybeData.colors.length > 0) {
              maybeData.colors.forEach(newColor => {
                const exists = savedColors.find(c => c.name === newColor.name);
                if (!exists) savedColors.push(newColor);
              });
              console.log(`Updated savedColors: ${savedColors.length} colors so far.`);
            }
          }
        } catch (err) {
          console.log("Could not parse partial data yet:", err);
        }
      }

      if (status === "complete") break;

      tries++;
      await new Promise(r => setTimeout(r, 5000)); // 5–7 seconds between polls is healthy
    }

    if (status !== "complete") {
      console.log("ParseHub run did not complete in time, returning savedColors if available.");

      return new Response(JSON.stringify({
        brand: lastReadyData?.brand || "",
        style: lastReadyData?.style || "",
        colors: savedColors.length > 0 ? savedColors : lastReadyData?.colors || []
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // 3️⃣ Fetch the run results (with safe JSON check)
    try {
      const resultUrl = `https://www.parsehub.com/api/v2/runs/${runToken}/data?api_key=${parsehubApiKey}`;
      const resultRes = await fetch(resultUrl);
      console.log("Result fetch URL:", resultUrl);
      console.log("Result status:", resultRes.status);

      if (resultRes.status !== 200) {
        const body = await resultRes.text();
        console.log("Unexpected result body:", body.slice(0, 200));
        return new Response(JSON.stringify({
          error: "Unexpected result status from ParseHub",
          status: resultRes.status,
          body: body.slice(0, 500)
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }

      const contentType = resultRes.headers.get("content-type") || "";
      const resultText = await resultRes.text();

      if (!contentType.includes("application/json")) {
        console.log("Expected JSON but got:", resultText.slice(0, 200));
        return new Response(JSON.stringify({
          error: "Invalid ParseHub response",
          hint: "Did you run as public or missing API key?",
          resultText: resultText.slice(0, 500)
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }

      const resultData = JSON.parse(resultText);
      console.log("ParseHub data:", resultData);
      if (!resultData || Object.keys(resultData).length === 0) {
        console.log("ParseHub returned an empty object. Possible causes: selectors did not extract, run was incomplete, or API key has restricted access.");
      }
      if (!resultData.colors || !Array.isArray(resultData.colors) || resultData.colors.length === 0) {
        console.log("⚠️ No valid colors array found in ParseHub response:", resultData);
        return new Response(JSON.stringify({
          error: "No valid colors array returned from ParseHub",
          data: resultData
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }

      // Treat style and title as the same (prefer style, but fallback to title)
      if (resultData.title && !resultData.style) {
        resultData.style = resultData.title;
      }

      // If brand is missing but style has "-", split it
      if (!resultData.brand && resultData.style && resultData.style.includes("-")) {
        const parts = resultData.style.split(/\s*-\s*/);
        resultData.brand = parts[0] || "";
        resultData.style = parts.slice(1).join(" - ").trim();
        console.log("✅ Auto-split brand/style:", resultData.brand, resultData.style);
      }

      if (!resultData.brand) {
        console.log("⚠️ Brand missing in ParseHub response:", resultData);
        return new Response(JSON.stringify({
          error: "Brand missing from ParseHub",
          data: resultData
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }

      return new Response(JSON.stringify({
        brand: resultData.brand,
        style: resultData.style,
        colors: resultData.colors
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });

    } catch (err) {
      console.log("Error parsing result JSON:", err);
      return new Response(JSON.stringify({ error: "Failed to parse ParseHub output", details: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
  } catch (err) {
    console.log("Unhandled top-level error:", err);
    return new Response(JSON.stringify({ error: "Unhandled server error", details: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
});