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

    // Parse request body - expects pre-parsed Excel data from n8n
    const body = await req.json();
    const { rows, date_column, registration_columns } = body;

    if (!rows || !Array.isArray(rows)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid rows array. Expected pre-parsed Excel data from n8n." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!date_column) {
      return new Response(
        JSON.stringify({ error: "Missing date_column parameter" }),
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

    // If registration_columns not provided, try to auto-detect from first row
    let regColumns = registration_columns;
    if (!regColumns && rows.length > 0) {
      const firstRow = rows[0];
      regColumns = Object.keys(firstRow).filter((key) => {
        const normalizedKey = key.replace(/\s+/g, "").toUpperCase();
        return vehicleMap.has(normalizedKey);
      });
    }

    if (!regColumns || regColumns.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No vehicle registration columns found. Provide registration_columns or ensure column headers match vehicle registrations.",
          available_vehicles: vehicles?.map(v => v.registration) || []
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process records
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const row of rows) {
      try {
        // Get date from the row
        const dateValue = row[date_column];
        if (!dateValue) {
          results.skipped++;
          continue;
        }

        // Parse the date (handle various formats)
        let recordDate: string;
        if (typeof dateValue === "number") {
          // Excel serial date
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
          recordDate = date.toISOString().split("T")[0];
        } else if (typeof dateValue === "string") {
          // Try to parse string date
          const parsed = new Date(dateValue);
          if (isNaN(parsed.getTime())) {
            results.skipped++;
            results.errors.push(`Invalid date: ${dateValue}`);
            continue;
          }
          recordDate = parsed.toISOString().split("T")[0];
        } else {
          results.skipped++;
          continue;
        }

        // Process each registration column
        for (const regColumn of regColumns) {
          const mileageValue = row[regColumn];
          if (mileageValue === undefined || mileageValue === null || mileageValue === "") {
            continue;
          }

          const dailyMileage = typeof mileageValue === "number" 
            ? mileageValue 
            : parseFloat(String(mileageValue).replace(/[^0-9.-]/g, ""));

          if (isNaN(dailyMileage) || dailyMileage < 0) {
            continue;
          }

          // Find vehicle ID
          const normalizedReg = regColumn.replace(/\s+/g, "").toUpperCase();
          const vehicleId = vehicleMap.get(normalizedReg);

          if (!vehicleId) {
            results.errors.push(`Vehicle not found: ${regColumn}`);
            continue;
          }

          // Upsert the mileage record
          const { error: upsertError } = await supabase
            .from("mileage_records")
            .upsert(
              {
                vehicle_id: vehicleId,
                record_date: recordDate,
                daily_mileage: Math.round(dailyMileage),
                source: "n8n-excel",
              },
              {
                onConflict: "vehicle_id,record_date",
              }
            );

          if (upsertError) {
            results.skipped++;
            results.errors.push(`Failed to import ${regColumn} on ${recordDate}: ${upsertError.message}`);
          } else {
            results.imported++;
          }
        }
      } catch (rowError) {
        results.skipped++;
        results.errors.push(`Error processing row: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
      }
    }

    console.log("Excel import results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${results.imported} records, skipped ${results.skipped}`,
        details: results,
        processed_columns: regColumns,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in import-mileage-excel function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
