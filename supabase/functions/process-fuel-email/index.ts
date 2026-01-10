import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  // Handle CORS preflight
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

    const authenticatedUserId = claimsData.user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming request - Zapier will send form data or JSON
    const contentType = req.headers.get("content-type") || "";
    let fileContent: string | null = null;
    let fileName = "zapier-invoice";
    let userId: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      fileContent = body.fileContent || body.attachment || body.file_content;
      fileName = body.fileName || body.file_name || body.filename || "zapier-invoice";
      userId = body.userId || body.user_id;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const attachment = formData.get("attachment") as File | null;
      
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        fileContent = `data:${file.type};base64,${base64}`;
        fileName = file.name;
      } else if (attachment) {
        const arrayBuffer = await attachment.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        fileContent = `data:${attachment.type};base64,${base64}`;
        fileName = attachment.name;
      }
      
      userId = formData.get("userId") as string || formData.get("user_id") as string;
    }

    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: "No file content provided. Send 'fileContent' or 'attachment' in the request." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no userId provided, use authenticated user's ID
    if (!userId) {
      userId = authenticatedUserId;
    }

    // Verify userId matches authenticated user (prevent accessing other users' data)
    if (userId !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: userId mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's vehicles for registration matching
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, registration")
      .eq("user_id", userId);

    if (vehiclesError) {
      console.error("Error fetching vehicles:", vehiclesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user vehicles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vehicleRegistrations = vehicles?.map((v) => v.registration) || [];

    // Call AI to extract fuel data
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
  - costPerLitre: Price per litre
  - totalCost: Total cost for this line
  - mileage: Vehicle mileage if shown

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
          { role: "user", content: `Extract fuel data from this invoice:\n\nFile: ${fileName}\n\nContent:\n${fileContent}` },
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

    // Parse AI response
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

    // Match registrations to vehicle IDs and create fuel records
    const createdRecords: any[] = [];
    const failedRecords: any[] = [];
    const skippedDuplicates: any[] = [];

    for (const item of extractedData.lineItems) {
      // Try to match registration
      const normalizedReg = item.registration?.replace(/\s+/g, "").toUpperCase() || "";
      const matchedVehicle = vehicles?.find(
        (v) => v.registration.replace(/\s+/g, "").toUpperCase() === normalizedReg
      );

      if (!matchedVehicle) {
        failedRecords.push({
          ...item,
          reason: `Vehicle registration "${item.registration}" not found in fleet`,
        });
        continue;
      }

      const fillDate = extractedData.invoiceDate || new Date().toISOString().split("T")[0];
      const litres = item.litres || 0;
      const totalCost = item.totalCost || (item.litres || 0) * (item.costPerLitre || 0);

      // Check for duplicate: same vehicle, same date, similar litres or cost
      const { data: existingRecords } = await supabase
        .from("fuel_records")
        .select("id, litres, total_cost")
        .eq("vehicle_id", matchedVehicle.id)
        .eq("fill_date", fillDate);

      const isDuplicate = existingRecords?.some((record) => {
        // Consider it a duplicate if litres match within 0.5L or total cost matches within £1
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

      // Create fuel record
      const { data: fuelRecord, error: insertError } = await supabase
        .from("fuel_records")
        .insert({
          vehicle_id: matchedVehicle.id,
          fill_date: fillDate,
          litres: litres,
          cost_per_litre: item.costPerLitre || 0,
          total_cost: totalCost,
          mileage: item.mileage || null,
          station: extractedData.station || null,
          notes: `Auto-imported from email: ${fileName}`,
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
