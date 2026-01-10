import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONTENT_LENGTH = 500000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileContent, fileName, vehicleRegistrations } = await req.json();
    
    console.log("========== FUEL INVOICE SCAN START ==========");
    console.log("📄 File name:", fileName);
    console.log("📋 Known registrations:", vehicleRegistrations);
    console.log("📏 Content length:", fileContent?.length || 0, "chars");
    console.log("🖼️ Is image:", fileContent?.startsWith('data:image/') ? "YES" : "NO");
    
    if (!fileContent) {
      console.log("❌ ERROR: No file content provided");
      return new Response(
        JSON.stringify({ error: "File content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let processedContent = fileContent;
    let isImage = false;
    
    if (fileContent.startsWith('data:image/')) {
      isImage = true;
      if (fileContent.length > MAX_CONTENT_LENGTH * 2) {
        return new Response(
          JSON.stringify({ 
            error: "Image file is too large for AI processing. Please upload a smaller image (under 5MB) or use a PDF/text document instead.",
            userMessage: true 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (fileContent.length > MAX_CONTENT_LENGTH) {
        processedContent = fileContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated due to length...]";
        console.log(`Content truncated from ${fileContent.length} to ${MAX_CONTENT_LENGTH} characters`);
      }
    }

    const vehicleList = vehicleRegistrations?.length > 0 
      ? `Known vehicle registrations in the fleet: ${vehicleRegistrations.join(', ')}`
      : '';

    const systemPrompt = `You are an expert fuel invoice analyzer for UK fleet management.

Analyze the provided fuel invoice and extract detailed information about each fuel purchase line item.

${vehicleList}

CRITICAL - Understand UK fuel invoice terminology:
- LITRES: The VOLUME of fuel (typically 20-80 litres per fill-up for vans, 30-60 for cars). Look for "L", "Ltr", "Litres" columns.
- COST PER LITRE (PPL): The PRICE per litre (typically £1.30-£1.80 in UK). Look for "PPL", "Price/L", "£/L" columns.
- TOTAL COST: The MONEY AMOUNT paid (litres × cost per litre). Look for "Total", "Amount", "Net", "£" columns.

IMPORTANT: Do NOT confuse total cost with litres! If a number is around £15-£120 it's likely the TOTAL COST, not litres.
- If you see only total cost and cost per litre, calculate litres = total_cost / cost_per_litre
- If you see only total cost and litres, calculate cost_per_litre = total_cost / litres
- UK fuel prices are typically £1.30-£1.80 per litre - use this to validate your extraction

For each vehicle/line item on the invoice, extract:
- Vehicle registration number (match to known registrations if possible, UK format like AB12 CDE)
- Litres of fuel purchased (VOLUME, typically 20-80 for a fill-up)
- Cost per litre in GBP (PRICE, typically £1.30-£1.80)
- Total cost for that line in GBP (MONEY PAID = litres × cost per litre)
- Mileage (if shown)

Also extract:
- Invoice date
- Station/supplier name
- Overall invoice total

Return all line items found on the invoice. Each line typically represents fuel purchased for a different vehicle.
If you cannot determine a value, use null.

VALIDATION: Before returning, verify that total_cost ≈ litres × costPerLitre for each line item.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Please analyze this fuel invoice image (${fileName}) and extract all fuel purchase line items:` },
          { type: "image_url", image_url: { url: processedContent } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Please analyze this fuel invoice document (${fileName}):\n\n${processedContent}`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_fuel_invoice",
              description: "Extract structured data from a fuel invoice",
              parameters: {
                type: "object",
                properties: {
                  invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
                  station: { type: "string", description: "Fuel station or supplier name" },
                  invoiceTotal: { type: "number", description: "Total invoice amount in GBP" },
                  lineItems: {
                    type: "array",
                    description: "Individual fuel purchase line items",
                    items: {
                      type: "object",
                      properties: {
                        registration: { type: "string", description: "Vehicle registration number" },
                        litres: { type: "number", description: "Litres of fuel purchased" },
                        costPerLitre: { type: "number", description: "Cost per litre in GBP" },
                        totalCost: { type: "number", description: "Total cost for this line in GBP" },
                        mileage: { type: "number", description: "Vehicle mileage if shown" }
                      },
                      required: ["registration", "litres", "costPerLitre", "totalCost"]
                    }
                  }
                },
                required: ["lineItems"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_fuel_invoice" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment.", userMessage: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits.", userMessage: true }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorText.includes("context length") || errorText.includes("too many tokens")) {
        return new Response(
          JSON.stringify({ error: "Document is too large to process. Please try a smaller file.", userMessage: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to analyze fuel invoice");
    }

    const data = await response.json();
    
    console.log("========== AI RESPONSE RECEIVED ==========");
    console.log("🤖 Full AI response:", JSON.stringify(data, null, 2));
    
    let extractedData = null;
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const functionArgs = toolCalls[0].function?.arguments;
      console.log("🔧 Tool call arguments (raw):", functionArgs);
      if (functionArgs) {
        extractedData = JSON.parse(functionArgs);
      }
    }

    if (!extractedData) {
      const content = data.choices?.[0]?.message?.content;
      console.log("📝 Message content (fallback):", content);
      if (content) {
        try {
          extractedData = JSON.parse(content);
        } catch {
          extractedData = { lineItems: [] };
        }
      }
    }

    console.log("========== EXTRACTED DATA ==========");
    console.log("📊 Invoice Date:", extractedData?.invoiceDate);
    console.log("⛽ Station:", extractedData?.station);
    console.log("💰 Invoice Total:", extractedData?.invoiceTotal);
    console.log("📋 Number of line items:", extractedData?.lineItems?.length || 0);
    
    if (extractedData?.lineItems) {
      extractedData.lineItems.forEach((item: any, index: number) => {
        console.log(`\n--- Line Item ${index + 1} ---`);
        console.log(`  🚗 Registration: ${item.registration}`);
        console.log(`  ⛽ Litres: ${item.litres}`);
        console.log(`  💷 Cost per litre: £${item.costPerLitre}`);
        console.log(`  💰 Total cost: £${item.totalCost}`);
        console.log(`  📏 Mileage: ${item.mileage || 'N/A'}`);
        
        // Validation check
        if (item.litres && item.costPerLitre && item.totalCost) {
          const calculated = item.litres * item.costPerLitre;
          const diff = Math.abs(calculated - item.totalCost);
          const valid = diff < 1; // Allow £1 tolerance
          console.log(`  ✅ Validation: ${item.litres} × £${item.costPerLitre} = £${calculated.toFixed(2)} (${valid ? 'VALID' : '⚠️ MISMATCH - diff: £' + diff.toFixed(2)})`);
        }
        
        // Range checks
        if (item.costPerLitre < 1.20 || item.costPerLitre > 2.00) {
          console.log(`  ⚠️ WARNING: Cost per litre £${item.costPerLitre} is outside typical UK range (£1.20-£2.00)`);
        }
        if (item.litres > 100) {
          console.log(`  ⚠️ WARNING: Litres ${item.litres} seems high for a single fill-up`);
        }
      });
    }
    
    console.log("\n========== FUEL INVOICE SCAN END ==========");

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scanning fuel invoice:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to scan fuel invoice" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
