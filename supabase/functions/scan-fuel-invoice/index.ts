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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.log("Auth error:", userError?.message || "No user found");
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

CRITICAL - UK FUELS / FUEL CARD INVOICE FORMAT:
These invoices have a "Transaction Detail" table with columns that can be confusing:
- "Quantity" column = LITRES of fuel (e.g., 54.75, 95.42, 65.51)
- "PPL" column = Price Per Litre in PENCE (e.g., 116.42 means £1.1642 per litre, 119.08 means £1.1908)
- "Net Amount £" column = Cost BEFORE VAT in pounds
- "Date" column = The ACTUAL TRANSACTION DATE when fuel was purchased (USE THIS as the fill date, NOT the invoice date!)

CRITICAL CONVERSION: PPL is in PENCE! Divide by 100 to get pounds.
- PPL 116.42 = £1.1642 per litre
- PPL 119.08 = £1.1908 per litre

CRITICAL - VAT HANDLING:
UK fuel invoices typically show NET amounts (before VAT). You MUST add 20% VAT to get the actual cost paid:
- netCostPerLitre: The PPL ÷ 100 (e.g., 116.42 → 1.1642)
- costPerLitre: netCostPerLitre × 1.2 (add 20% VAT, e.g., 1.1642 × 1.2 = 1.397)
- netAmount: From the "Net Amount £" column
- totalCost: netAmount × 1.2 (add 20% VAT, e.g., 63.74 × 1.2 = 76.49)

For EACH transaction row, extract:
- transactionDate: The DATE from the transaction row (e.g., "06/10/2025" → "2025-10-06") - THIS IS THE FILL DATE
- registration: Vehicle registration number
- litres: From the "Quantity" column (the fuel volume)
- costPerLitre: (PPL ÷ 100) × 1.2 to include VAT
- totalCost: Net Amount × 1.2 to include VAT (this is what was actually paid)
- mileage: If shown
- station: The station name for this specific transaction

Also extract:
- invoiceDate: The invoice date (for reference only, not used for fill dates)
- invoiceTotal: Total GROSS invoice amount (including VAT) - look for "Gross Amount" or "Total Invoice Amount"

IMPORTANT: Each line item should have its OWN transactionDate - do not use the invoice date!
IMPORTANT: Always return costs INCLUDING VAT (multiply net by 1.2)!`;

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
              description: "Extract structured data from a fuel invoice with individual transaction dates",
              parameters: {
                type: "object",
                properties: {
                  invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format (for reference)" },
                  invoiceTotal: { type: "number", description: "Total invoice amount in GBP" },
                  lineItems: {
                    type: "array",
                    description: "Individual fuel purchase line items with their own transaction dates",
                    items: {
                      type: "object",
                      properties: {
                        transactionDate: { type: "string", description: "The actual transaction/fill date in YYYY-MM-DD format (from the Date column)" },
                        registration: { type: "string", description: "Vehicle registration number" },
                        litres: { type: "number", description: "Litres of fuel from the Quantity column" },
                        costPerLitre: { type: "number", description: "Cost per litre in GBP (PPL divided by 100)" },
                        totalCost: { type: "number", description: "Total cost from Net Amount column in GBP" },
                        mileage: { type: "number", description: "Vehicle mileage if shown" },
                        station: { type: "string", description: "Station name for this transaction" }
                      },
                      required: ["transactionDate", "registration", "litres", "costPerLitre", "totalCost"]
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
    console.log("💰 Invoice Total:", extractedData?.invoiceTotal);
    console.log("📋 Number of line items:", extractedData?.lineItems?.length || 0);
    
    // Validate and filter line items - reject invalid ones
    const validatedLineItems: any[] = [];
    const rejectedLineItems: any[] = [];
    
    if (extractedData?.lineItems) {
      extractedData.lineItems.forEach((item: any, index: number) => {
        console.log(`\n--- Line Item ${index + 1} ---`);
        console.log(`  📅 Transaction Date: ${item.transactionDate}`);
        console.log(`  🚗 Registration: ${item.registration}`);
        console.log(`  ⛽ Litres: ${item.litres}`);
        console.log(`  💷 Cost per litre (inc VAT): £${item.costPerLitre?.toFixed(4) || 'N/A'}`);
        console.log(`  💰 Total cost (inc VAT): £${item.totalCost?.toFixed(2) || 'N/A'}`);
        console.log(`  ⛽ Station: ${item.station || 'N/A'}`);
        console.log(`  📏 Mileage: ${item.mileage || 'N/A'}`);
        
        const issues: string[] = [];
        
        // Required fields check
        if (!item.transactionDate || !item.registration || !item.litres || !item.costPerLitre || !item.totalCost) {
          issues.push('Missing required fields');
        }
        
        // Math validation - litres × costPerLitre should ≈ totalCost (within 5% or £2)
        if (item.litres && item.costPerLitre && item.totalCost) {
          const calculated = item.litres * item.costPerLitre;
          const diff = Math.abs(calculated - item.totalCost);
          const percentDiff = (diff / item.totalCost) * 100;
          const valid = diff < 2 || percentDiff < 5;
          console.log(`  🔢 Validation: ${item.litres} × £${item.costPerLitre?.toFixed(4)} = £${calculated.toFixed(2)} vs £${item.totalCost?.toFixed(2)} (diff: £${diff.toFixed(2)}, ${percentDiff.toFixed(1)}%)`);
          
          if (!valid) {
            issues.push(`Math mismatch: calculated £${calculated.toFixed(2)} vs reported £${item.totalCost?.toFixed(2)}`);
          }
        }
        
        // Range checks - with 20% VAT, expect £1.10-£2.50 range for UK fuel
        if (item.costPerLitre && (item.costPerLitre < 1.10 || item.costPerLitre > 2.50)) {
          issues.push(`Cost per litre £${item.costPerLitre?.toFixed(4)} outside UK range (£1.10-£2.50)`);
        }
        
        // Litres sanity check - most vehicle tanks are under 100L
        if (item.litres && item.litres > 150) {
          issues.push(`Litres ${item.litres} exceeds maximum (150L)`);
        }
        if (item.litres && item.litres < 1) {
          issues.push(`Litres ${item.litres} too small (< 1L)`);
        }
        
        // Total cost sanity check
        if (item.totalCost && (item.totalCost < 1 || item.totalCost > 500)) {
          issues.push(`Total cost £${item.totalCost} outside expected range (£1-£500)`);
        }
        
        // Date validation
        if (item.transactionDate) {
          const dateMatch = item.transactionDate.match(/^\d{4}-\d{2}-\d{2}$/);
          if (!dateMatch) {
            issues.push(`Invalid date format: ${item.transactionDate}`);
          } else {
            const txDate = new Date(item.transactionDate);
            const now = new Date();
            const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
            if (txDate > now) {
              issues.push(`Future date: ${item.transactionDate}`);
            }
            if (txDate < twoYearsAgo) {
              issues.push(`Date too old: ${item.transactionDate}`);
            }
          }
        }
        
        if (issues.length > 0) {
          console.log(`  ❌ REJECTED: ${issues.join('; ')}`);
          rejectedLineItems.push({ ...item, rejectionReasons: issues });
        } else {
          console.log(`  ✅ VALID`);
          validatedLineItems.push(item);
        }
      });
    }
    
    console.log(`\n========== VALIDATION SUMMARY ==========`);
    console.log(`✅ Valid line items: ${validatedLineItems.length}`);
    console.log(`❌ Rejected line items: ${rejectedLineItems.length}`);
    
    // Replace lineItems with only validated ones
    if (extractedData) {
      extractedData.lineItems = validatedLineItems;
      extractedData.rejectedLineItems = rejectedLineItems;
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
