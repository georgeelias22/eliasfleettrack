import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key and user_id from query params or headers
    const url = new URL(req.url);
    const apiKey = url.searchParams.get("api_key") || req.headers.get("x-api-key");
    const userId = url.searchParams.get("user_id") || req.headers.get("x-user-id");

    // Validate API key
    const expectedApiKey = Deno.env.get("MILEAGE_IMPORT_API_KEY");
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing user_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { records } = body;

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid records array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's vehicles to map registrations to vehicle IDs
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, registration")
      .eq("user_id", userId);

    if (vehiclesError) {
      console.error("Error fetching vehicles:", vehiclesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch vehicles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a map of registration to vehicle ID (case-insensitive, no spaces)
    const vehicleMap = new Map<string, string>();
    vehicles?.forEach((v) => {
      const normalizedReg = v.registration.replace(/\s+/g, "").toUpperCase();
      vehicleMap.set(normalizedReg, v.id);
    });

    // Process records
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const record of records) {
      try {
        const { registration, date, daily_mileage, odometer_reading } = record;

        if (!registration || !date || daily_mileage === undefined) {
          results.skipped++;
          results.errors.push(`Missing required fields for record: ${JSON.stringify(record)}`);
          continue;
        }

        // Normalize registration
        const normalizedReg = registration.replace(/\s+/g, "").toUpperCase();
        const vehicleId = vehicleMap.get(normalizedReg);

        if (!vehicleId) {
          results.skipped++;
          results.errors.push(`Vehicle not found: ${registration}`);
          continue;
        }

        // Upsert the mileage record
        const { error: upsertError } = await supabase
          .from("mileage_records")
          .upsert(
            {
              vehicle_id: vehicleId,
              record_date: date,
              daily_mileage: Math.round(daily_mileage),
              odometer_reading: odometer_reading ? Math.round(odometer_reading) : null,
              source: "n8n",
            },
            {
              onConflict: "vehicle_id,record_date",
            }
          );

        if (upsertError) {
          results.skipped++;
          results.errors.push(`Failed to import ${registration} on ${date}: ${upsertError.message}`);
        } else {
          results.imported++;
        }
      } catch (recordError) {
        results.skipped++;
        results.errors.push(`Error processing record: ${recordError instanceof Error ? recordError.message : String(recordError)}`);
      }
    }

    console.log("Import results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${results.imported} records, skipped ${results.skipped}`,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in import-mileage function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
