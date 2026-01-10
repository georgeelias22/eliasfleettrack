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
  const m = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return null;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const { fileContent, fileName, vehicleRegistrations } = await req.json();

    const expectedInvoiceDate = parseExpectedInvoiceDate(fileName) || null;

    console.log("========== FUEL INVOICE SCAN START (OpenAI GPT-4o) ==========");
    console.log("📄 File name:", fileName);
    console.log("🧭 Expected invoice date (from filename):", expectedInvoiceDate || 'N/A');
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

    // For PDFs that were converted to text, the client sends text content
    // For images, it sends base64 data URLs
    const isImage = fileContent.startsWith('data:image/');
    
    const vehicleList = vehicleRegistrations?.length > 0 
      ? `Known vehicle registrations in the fleet: ${vehicleRegistrations.join(', ')}`
      : '';

    const systemPrompt = `You are an expert fuel invoice analyzer for UK fleet management.

Analyze the provided fuel invoice and extract detailed information about each fuel purchase line item.

${expectedInvoiceDate ? `CRITICAL: The expected invoice date from the filename is ${expectedInvoiceDate}. ONLY extract transactions that are within 60 days of this date. If you see dates from different months/years, those are from a DIFFERENT invoice and MUST be ignored.` : ''}

${vehicleList}

CRITICAL - UK FUELS / FUEL CARD INVOICE FORMAT:
These invoices have a "Transaction Detail" table with columns:
- "Date" = The ACTUAL TRANSACTION DATE when fuel was purchased (USE THIS as fill_date)
- "Quantity" column = LITRES of fuel (e.g., 54.75, 95.42)
- "PPL" column = Price Per Litre in PENCE (e.g., 116.42 means £1.1642 per litre)
- "Net Amount £" = Cost BEFORE VAT

CRITICAL PPL CONVERSION: PPL is in PENCE! Divide by 100 to get pounds.
- PPL 116.42 = £1.1642 per litre

CRITICAL VAT: UK fuel has 20% VAT. Add VAT to get actual costs:
- costPerLitre = (PPL ÷ 100) × 1.2
- totalCost = Net Amount × 1.2

For EACH transaction row in the table, extract:
- transactionDate: The DATE from that row (format as YYYY-MM-DD)
- registration: Vehicle registration from that row
- litres: From the "Quantity" column
- costPerLitre: (PPL ÷ 100) × 1.2 to include VAT
- totalCost: Net Amount × 1.2 to include VAT
- station: The station/site name for that row

IMPORTANT: Each row has its OWN date - use the date from THAT row, not the invoice header date.
IMPORTANT: ONLY extract data you can clearly see in the document. Do NOT make up or estimate values.
IMPORTANT: If you cannot read a value clearly, skip that row entirely rather than guessing.`;

    let messages: any[];

    if (isImage) {
      // For images, use vision directly
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this fuel invoice image (${fileName}) and extract all visible fuel purchase transactions. Only include data you can clearly read from the image.` },
            { type: "image_url", image_url: { url: fileContent, detail: "high" } }
          ]
        }
      ];
    } else {
      // For text content (extracted from PDF)
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this fuel invoice document (${fileName}) and extract all fuel purchase transactions.\n\nDocument content:\n${fileContent}`
        }
      ];
    }

    console.log("🤖 Calling OpenAI GPT-4o...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
                invoiceTotal: { type: "number", description: "Total invoice amount including VAT in GBP" },
                lineItems: {
                  type: "array",
                  description: "Individual fuel purchase line items",
                  items: {
                    type: "object",
                    properties: {
                      transactionDate: { type: "string", description: "Transaction date in YYYY-MM-DD format" },
                      registration: { type: "string", description: "Vehicle registration number" },
                      litres: { type: "number", description: "Litres of fuel" },
                      costPerLitre: { type: "number", description: "Cost per litre including VAT in GBP" },
                      totalCost: { type: "number", description: "Total cost including VAT in GBP" },
                      mileage: { type: "number", description: "Vehicle mileage if shown" },
                      station: { type: "string", description: "Station name" }
                    },
                    required: ["transactionDate", "registration", "litres", "costPerLitre", "totalCost"]
                  }
                }
              },
              required: ["lineItems"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "extract_fuel_invoice" } },
      max_tokens: 4096
    });

    console.log("✅ OpenAI response received");

    let extractedData = null;
    const toolCalls = response.choices?.[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      const functionArgs = toolCalls[0].function?.arguments;
      console.log("🔧 Tool call arguments:", functionArgs);
      if (functionArgs) {
        extractedData = JSON.parse(functionArgs);
      }
    }

    if (!extractedData) {
      const content = response.choices?.[0]?.message?.content;
      console.log("📝 Fallback to message content");
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

    // Anchor date for validation
    const anchorInvoiceDate = toDate(expectedInvoiceDate || extractedData?.invoiceDate);

    // Validate and filter line items
    const validatedLineItems: any[] = [];
    const rejectedLineItems: any[] = [];

    if (extractedData?.lineItems) {
      extractedData.lineItems.forEach((item: any, index: number) => {
        console.log(`\n--- Line Item ${index + 1} ---`);
        console.log(`  📅 Transaction Date: ${item.transactionDate}`);
        console.log(`  🚗 Registration: ${item.registration}`);
        console.log(`  ⛽ Litres: ${item.litres}`);
        console.log(`  💷 Cost per litre: £${item.costPerLitre?.toFixed(4) || 'N/A'}`);
        console.log(`  💰 Total cost: £${item.totalCost?.toFixed(2) || 'N/A'}`);
        console.log(`  ⛽ Station: ${item.station || 'N/A'}`);
        
        const issues: string[] = [];
        
        // Required fields check
        if (!item.transactionDate || !item.registration || !item.litres || !item.costPerLitre || !item.totalCost) {
          issues.push('Missing required fields');
        }
        
        // Math validation
        if (item.litres && item.costPerLitre && item.totalCost) {
          const calculated = item.litres * item.costPerLitre;
          const diff = Math.abs(calculated - item.totalCost);
          const percentDiff = (diff / item.totalCost) * 100;
          const valid = diff < 2 || percentDiff < 5;
          console.log(`  🔢 Validation: ${item.litres} × £${item.costPerLitre?.toFixed(4)} = £${calculated.toFixed(2)} vs £${item.totalCost?.toFixed(2)}`);
          
          if (!valid) {
            issues.push(`Math mismatch: calculated £${calculated.toFixed(2)} vs reported £${item.totalCost?.toFixed(2)}`);
          }
        }
        
        // Range checks
        if (item.costPerLitre && (item.costPerLitre < 1.10 || item.costPerLitre > 2.50)) {
          issues.push(`Cost per litre £${item.costPerLitre?.toFixed(4)} outside UK range`);
        }
        
        if (item.litres && item.litres > 150) {
          issues.push(`Litres ${item.litres} exceeds maximum`);
        }
        if (item.litres && item.litres < 1) {
          issues.push(`Litres ${item.litres} too small`);
        }
        
        if (item.totalCost && (item.totalCost < 1 || item.totalCost > 500)) {
          issues.push(`Total cost £${item.totalCost} outside expected range`);
        }
        
        // Date validation
        if (item.transactionDate) {
          const dateMatch = item.transactionDate.match(/^\d{4}-\d{2}-\d{2}$/);
          if (!dateMatch) {
            issues.push(`Invalid date format: ${item.transactionDate}`);
          } else {
            const txDate = toDate(item.transactionDate);
            const now = new Date();
            const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

            if (!txDate) {
              issues.push(`Invalid date: ${item.transactionDate}`);
            } else {
              if (txDate > now) {
                issues.push(`Future date: ${item.transactionDate}`);
              }
              if (txDate < twoYearsAgo) {
                issues.push(`Date too old: ${item.transactionDate}`);
              }

              // Date must be within 60 days of anchor invoice date
              if (anchorInvoiceDate) {
                const min = new Date(anchorInvoiceDate);
                min.setUTCDate(min.getUTCDate() - 60);
                const max = new Date(anchorInvoiceDate);
                max.setUTCDate(max.getUTCDate() + 60);

                if (txDate < min || txDate > max) {
                  issues.push(`Date ${item.transactionDate} outside invoice window (${expectedInvoiceDate || extractedData?.invoiceDate} ± 60 days)`);
                }
              }
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

    console.log("\n========== SUMMARY ==========");
    console.log(`✅ Valid line items: ${validatedLineItems.length}`);
    console.log(`❌ Rejected line items: ${rejectedLineItems.length}`);

    return new Response(
      JSON.stringify({
        ...extractedData,
        lineItems: validatedLineItems,
        rejectedLineItems: rejectedLineItems.length > 0 ? rejectedLineItems : undefined,
        _meta: {
          model: "gpt-4o",
          expectedInvoiceDate,
          totalExtracted: extractedData?.lineItems?.length || 0,
          totalValid: validatedLineItems.length,
          totalRejected: rejectedLineItems.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing fuel invoice:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze fuel invoice" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
