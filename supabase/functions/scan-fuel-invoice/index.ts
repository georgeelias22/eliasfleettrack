import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseExpectedInvoiceDate(fileName?: string): string | null {
  if (!fileName) return null;
  const match = fileName.match(/(\d{2})[_.-](\d{2})[_.-](\d{4})/g);
  if (!match || match.length === 0) return null;
  const last = match[match.length - 1];
  const parts = last.match(/(\d{2})[_.-](\d{2})[_.-](\d{4})/);
  if (!parts) return null;
  const [, dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json(401, { error: "Unauthorized" });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const { fileContent, fileImages, fileName, vehicleRegistrations } = await req.json();

    if ((!fileContent || typeof fileContent !== "string") && (!Array.isArray(fileImages) || fileImages.length === 0)) {
      return json(400, { error: "fileContent or fileImages is required" });
    }

    const expectedInvoiceDate = parseExpectedInvoiceDate(fileName) || null;

    // Keep prompts compact to avoid token blowups.
    const systemPrompt = `Extract UK fuel card invoice TRANSACTION line items.
Rules:
- Only extract values visible in the document; never guess.
- Use each row's Date as transactionDate (YYYY-MM-DD).
- Quantity = litres.
- PPL is pence: (PPL/100) gives net £/L.
- Add 20% VAT: costPerLitre=(PPL/100)*1.2, totalCost=(NetAmount)*1.2.
${expectedInvoiceDate ? `- Only include transaction dates within ±60 days of ${expectedInvoiceDate}.` : ""}
${Array.isArray(vehicleRegistrations) && vehicleRegistrations.length ? `- Registrations to expect: ${vehicleRegistrations.join(", ")}` : ""}`;

    const userParts: any[] = [
      {
        type: "text",
        text: `Extract fuel purchase line items from ${fileName || "the invoice"}. Return only what you can read clearly.`,
      },
    ];

    if (Array.isArray(fileImages) && fileImages.length) {
      // Multiple pages (images) in one request; cap to avoid huge TPM usage.
      const images = fileImages.slice(0, 2);
      for (const url of images) {
        userParts.push({ type: "image_url", image_url: { url, detail: "high" } });
      }
    } else {
      // Text path: hard cap to reduce TPM issues.
      const trimmed = fileContent.length > 40000 ? fileContent.slice(0, 40000) + "\n[truncated]" : fileContent;
      userParts.push({ type: "text", text: `\n\nDocument text:\n${trimmed}` });
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_fuel_invoice",
            description: "Extract structured fuel invoice data",
            parameters: {
              type: "object",
              properties: {
                invoiceDate: { type: "string" },
                invoiceTotal: { type: "number" },
                lineItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      transactionDate: { type: "string" },
                      registration: { type: "string" },
                      litres: { type: "number" },
                      costPerLitre: { type: "number" },
                      totalCost: { type: "number" },
                      mileage: { type: "number" },
                      station: { type: "string" },
                    },
                    required: ["transactionDate", "registration", "litres", "costPerLitre", "totalCost"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["lineItems"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_fuel_invoice" } },
      // keep output bounded
      max_tokens: 1200,
    });

    let extracted: any = null;
    const toolCalls = resp.choices?.[0]?.message?.tool_calls;
    if (toolCalls?.length) {
      extracted = JSON.parse(toolCalls[0].function?.arguments || "{}") || null;
    }
    if (!extracted) extracted = { lineItems: [] };

    const anchorInvoiceDate = toDate(expectedInvoiceDate || extracted.invoiceDate);

    const validated: any[] = [];
    const rejected: any[] = [];

    for (const item of (extracted.lineItems || []) as any[]) {
      const issues: string[] = [];

      if (!item.transactionDate || !item.registration || !item.litres || !item.costPerLitre || !item.totalCost) {
        issues.push("Missing required fields");
      }

      // date format + window
      if (item.transactionDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.transactionDate)) {
        issues.push(`Invalid date format: ${item.transactionDate}`);
      } else if (item.transactionDate && anchorInvoiceDate) {
        const tx = toDate(item.transactionDate);
        if (!tx) issues.push(`Invalid date: ${item.transactionDate}`);
        else {
          const min = new Date(anchorInvoiceDate);
          min.setUTCDate(min.getUTCDate() - 60);
          const max = new Date(anchorInvoiceDate);
          max.setUTCDate(max.getUTCDate() + 60);
          if (tx < min || tx > max) issues.push(`Date outside invoice window: ${item.transactionDate}`);
        }
      }

      // sanity
      if (item.costPerLitre && (item.costPerLitre < 1.0 || item.costPerLitre > 3.0)) issues.push("Cost per litre out of range");
      if (item.litres && (item.litres < 1 || item.litres > 200)) issues.push("Litres out of range");
      if (item.totalCost && (item.totalCost < 1 || item.totalCost > 800)) issues.push("Total cost out of range");

      if (item.litres && item.costPerLitre && item.totalCost) {
        const calc = item.litres * item.costPerLitre;
        const diff = Math.abs(calc - item.totalCost);
        const pct = (diff / item.totalCost) * 100;
        if (!(diff < 2 || pct < 5)) issues.push("Math mismatch");
      }

      if (issues.length) rejected.push({ ...item, rejectionReasons: issues });
      else validated.push(item);
    }

    return json(200, {
      ...extracted,
      lineItems: validated,
      rejectedLineItems: rejected.length ? rejected : undefined,
    });
  } catch (error: any) {
    // Map OpenAI token / rate issues to user-friendly 429.
    const status = typeof error?.status === "number" ? error.status : undefined;
    const message = error instanceof Error ? error.message : "Failed to analyze fuel invoice";

    if (status === 429) {
      return json(429, {
        error: "Invoice too large to analyze in one go. Please retry (we'll only send the first 1–2 pages) or upload a screenshot of the Transaction Detail table.",
        userMessage: true,
        details: message,
      });
    }

    console.error("Error processing fuel invoice:", error);
    return json(500, { error: "Failed to analyze fuel invoice", details: message });
  }
});
