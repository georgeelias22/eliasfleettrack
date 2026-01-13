import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Input validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB base64
const MAX_LITRES = 200;
const MAX_COST_PER_LITRE = 5;
const MAX_TOTAL_COST = 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FuelLineItem {
  registration?: string;
  litres?: number;
  costPerLitre?: number;
  totalCost?: number;
  mileage?: number;
}

interface ExtractedFuelData {
  invoiceDate?: string;
  station?: string;
  invoiceTotal?: number;
  lineItems?: FuelLineItem[];
}

function validateFuelLineItem(item: FuelLineItem): string[] {
  const errors: string[] = [];
  
  if (item.litres !== undefined) {
    if (typeof item.litres !== 'number' || isNaN(item.litres) || item.litres < 0 || item.litres > MAX_LITRES) {
      errors.push(`Invalid litres: ${item.litres} (must be 0-${MAX_LITRES})`);
    }
  }
  
  if (item.costPerLitre !== undefined) {
    if (typeof item.costPerLitre !== 'number' || isNaN(item.costPerLitre) || item.costPerLitre < 0 || item.costPerLitre > MAX_COST_PER_LITRE) {
      errors.push(`Invalid costPerLitre: ${item.costPerLitre} (must be 0-${MAX_COST_PER_LITRE})`);
    }
  }
  
  if (item.totalCost !== undefined) {
    if (typeof item.totalCost !== 'number' || isNaN(item.totalCost) || item.totalCost < 0 || item.totalCost > MAX_TOTAL_COST) {
      errors.push(`Invalid totalCost: ${item.totalCost} (must be 0-${MAX_TOTAL_COST})`);
    }
  }
  
  return errors;
}

function sanitizeString(str: string | undefined, maxLength: number): string {
  if (!str || typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>\"']/g, '');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const expectedApiKey = Deno.env.get("FUEL_IMPORT_API_KEY");

    const url = new URL(req.url);
    const urlApiKey = url.searchParams.get("api_key") || url.searchParams.get("key");
    const urlUserId = url.searchParams.get("user_id") || url.searchParams.get("userId");

    const apiKey = req.headers.get("x-api-key") || urlApiKey;
    const authHeader = req.headers.get("authorization");
    
    let userId: string | null = urlUserId;
    let isApiKeyAuth = false;

    if (apiKey) {
      if (!expectedApiKey || apiKey !== expectedApiKey) {
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isApiKeyAuth = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const supabaseClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = claimsData.user.id;
    } else {
      return new Response(
        JSON.stringify({ error: "Unauthorized - provide api_key URL parameter, x-api-key header, or Bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const contentType = req.headers.get("content-type") || "";
    let fileContent: string | null = null;
    let fileName = "n8n-invoice";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const rawContent = body.fileContent || body.attachment || body.file_content || body.file_base64;
      
      // SECURITY FIX: Validate file size
      if (rawContent && rawContent.length > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (rawContent) {
        if (rawContent.startsWith("data:")) {
          fileContent = rawContent;
        } else {
          fileContent = `data:image/jpeg;base64,${rawContent}`;
        }
      }
      fileName = sanitizeString(body.fileName || body.file_name || body.filename, 255) || "n8n-invoice";
      
      if (isApiKeyAuth && !userId) {
        userId = body.userId || body.user_id;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const attachment = formData.get("attachment") as File | null;
      
      const uploadedFile = file || attachment;
      if (uploadedFile) {
        // SECURITY FIX: Validate file size
        if (uploadedFile.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        fileContent = `data:${uploadedFile.type};base64,${base64}`;
        fileName = sanitizeString(uploadedFile.name, 255);
      }
      
      if (isApiKeyAuth && !userId) {
        userId = formData.get("userId") as string || formData.get("user_id") as string;
      }
    }

    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: "No file content provided. Send 'fileContent', 'file_base64', or 'attachment' in the request." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required when using API key authentication" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY FIX: Validate userId format
    if (!UUID_REGEX.test(userId)) {
      return new Response(
        JSON.stringify({ error: "Invalid userId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY FIX: Verify user exists and fetch only their vehicles
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, registration, user_id")
      .eq("user_id", userId);

    if (vehiclesError) {
      console.error("Error fetching vehicles:", vehiclesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user vehicles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vehicles || vehicles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No vehicles found for this user. Please add vehicles first.",
          createdRecords: [],
          failedRecords: [],
          skippedDuplicates: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vehicleRegistrations = vehicles.map((v) => v.registration);

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI processing not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a fuel invoice data extractor. Extract fuel purchase details from the provided document.

Known vehicle registrations: ${vehicleRegistrations.join(", ") || "None provided"}

Extract:
- invoiceDate: The date of the invoice (YYYY-MM-DD format)
- station: The fuel station or supplier name
- lineItems: Array of fuel purchases, each with:
  - registration: Vehicle registration (match to known registrations if possible)
  - litres: Amount of fuel in litres
  - costPerLitre: Price per litre (VAT-inclusive)
  - totalCost: Total cost for this line (VAT-inclusive)
  - mileage: Vehicle mileage if shown

IMPORTANT: All costs must be VAT-inclusive (gross amounts including 20% VAT).

Return structured JSON data.`;

    const isImage = fileContent.startsWith("data:image");
    const messages = isImage
      ? [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract fuel data from this invoice image: ${fileName}` },
              { type: "image_url", image_url: { url: fileContent } },
            ],
          },
        ]
      : [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract fuel data from this invoice:\n\nFile: ${fileName}\n\nContent:\n${fileContent.slice(0, 50000)}` },
        ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
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
                  invoiceTotal: { type: "number", description: "Total invoice amount" },
                  lineItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        registration: { type: "string" },
                        litres: { type: "number" },
                        costPerLitre: { type: "number" },
                        totalCost: { type: "number" },
                        mileage: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_fuel_invoice" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process invoice with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let extractedData: ExtractedFuelData | null = null;

    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      try {
        extractedData = JSON.parse(toolCalls[0].function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    if (!extractedData || !extractedData.lineItems || extractedData.lineItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No fuel data could be extracted from the invoice",
          extractedData 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY FIX: Validate invoice date
    let invoiceDate = extractedData.invoiceDate;
    if (invoiceDate) {
      if (!DATE_REGEX.test(invoiceDate)) {
        invoiceDate = new Date().toISOString().split("T")[0];
      } else {
        const date = new Date(invoiceDate);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        if (isNaN(date.getTime()) || date > now || date < oneYearAgo) {
          invoiceDate = new Date().toISOString().split("T")[0];
        }
      }
    } else {
      invoiceDate = new Date().toISOString().split("T")[0];
    }

    const createdRecords: any[] = [];
    const failedRecords: any[] = [];
    const skippedDuplicates: any[] = [];

    for (const item of extractedData.lineItems) {
      // SECURITY FIX: Validate each line item
      const itemErrors = validateFuelLineItem(item);
      if (itemErrors.length > 0) {
        failedRecords.push({
          ...item,
          reason: `Validation errors: ${itemErrors.join("; ")}`,
        });
        continue;
      }

      const normalizedReg = item.registration?.replace(/\s+/g, "").toUpperCase() || "";
      const matchedVehicle = vehicles.find(
        (v) => v.registration.replace(/\s+/g, "").toUpperCase() === normalizedReg
      );

      if (!matchedVehicle) {
        failedRecords.push({
          ...item,
          reason: `Vehicle registration "${item.registration}" not found in user's fleet`,
        });
        continue;
      }

      // SECURITY FIX: Double-check ownership
      if (matchedVehicle.user_id !== userId) {
        failedRecords.push({
          ...item,
          reason: `Vehicle does not belong to user`,
        });
        continue;
      }

      const fillDate = invoiceDate;
      const litres = item.litres || 0;
      const totalCost = item.totalCost || (item.litres || 0) * (item.costPerLitre || 0);

      // Check for duplicate
      const { data: existingRecords } = await supabase
        .from("fuel_records")
        .select("id, litres, total_cost")
        .eq("vehicle_id", matchedVehicle.id)
        .eq("fill_date", fillDate);

      const isDuplicate = existingRecords?.some((record) => {
        const litresDiff = Math.abs(record.litres - litres);
        const costDiff = Math.abs(record.total_cost - totalCost);
        return litresDiff < 0.5 || costDiff < 1;
      });

      if (isDuplicate) {
        skippedDuplicates.push({
          ...item,
          reason: `Duplicate record found for ${item.registration} on ${fillDate}`,
        });
        continue;
      }

      const { data: fuelRecord, error: insertError } = await supabase
        .from("fuel_records")
        .insert({
          vehicle_id: matchedVehicle.id,
          fill_date: fillDate,
          litres: litres,
          cost_per_litre: item.costPerLitre || 0,
          total_cost: totalCost,
          mileage: item.mileage || null,
          station: sanitizeString(extractedData.station, 255) || null,
          notes: `Auto-imported from email: ${sanitizeString(fileName, 100)}`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert fuel record:", insertError);
        failedRecords.push({
          ...item,
          reason: `Database error: ${insertError.message}`,
        });
      } else {
        createdRecords.push(fuelRecord);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed invoice: ${createdRecords.length} created, ${skippedDuplicates.length} duplicates skipped, ${failedRecords.length} failed`,
        createdRecords,
        skippedDuplicates,
        failedRecords,
        extractedData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing fuel email:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
