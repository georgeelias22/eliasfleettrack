import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { read, utils } from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VehicleRow {
  Device: string;
  "Route Length": string;
  Mileage: string;
  "First Movement": string;
  "Last Stop": string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for API key authentication
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("MILEAGE_IMPORT_API_KEY");
    
    if (!expectedApiKey) {
      console.error("MILEAGE_IMPORT_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the file from the request
    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: ArrayBuffer;
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      fileBuffer = await file.arrayBuffer();
    } else if (contentType.includes("application/json")) {
      // Handle base64 encoded file from n8n
      const body = await req.json();
      if (!body.file_base64) {
        return new Response(
          JSON.stringify({ error: "No file_base64 provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Decode base64
      const binaryString = atob(body.file_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    } else {
      // Raw binary
      fileBuffer = await req.arrayBuffer();
    }

    // Parse the Excel file
    const workbook = read(new Uint8Array(fileBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON, skipping the header row "Vehicle Information"
    const jsonData = utils.sheet_to_json<VehicleRow>(sheet, { range: 1 });
    
    console.log("Parsed Excel data:", JSON.stringify(jsonData, null, 2));

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const results: { vehicle: string; status: string; error?: string }[] = [];

    for (const row of jsonData) {
      const deviceName = row.Device;
      if (!deviceName || deviceName === "Device") continue; // Skip header rows
      
      // Parse route length (e.g., "415.32 mi" -> 415) - rounded to integer
      const routeLengthMatch = row["Route Length"]?.match(/^([\d.]+)/);
      const dailyMileage = routeLengthMatch ? Math.round(parseFloat(routeLengthMatch[1])) : 0;
      
      // Parse odometer mileage (e.g., "121723 mi" -> 121723)
      const mileageMatch = row["Mileage"]?.match(/^([\d.]+)/);
      const odometerReading = mileageMatch ? Math.round(parseFloat(mileageMatch[1])) : null;
      
      // Determine date from "Last Stop" or "First Movement"
      let recordDate: string | null = null;
      const lastStop = row["Last Stop"];
      const firstMovement = row["First Movement"];
      
      if (lastStop) {
        // Parse date from "2025-12-17 16:22:19" format
        recordDate = lastStop.split(" ")[0];
      } else if (firstMovement) {
        recordDate = firstMovement.split(" ")[0];
      }
      
      if (!recordDate) {
        recordDate = new Date().toISOString().split("T")[0];
      }

      // Skip if no meaningful data
      if (dailyMileage === 0 && !odometerReading) {
        results.push({ vehicle: deviceName, status: "skipped", error: "No mileage data" });
        continue;
      }

      // Find vehicle by name (make + model match or partial match)
      const { data: vehicles, error: vehicleError } = await serviceClient
        .from("vehicles")
        .select("id, registration, make, model")
        .or(`make.ilike.%${deviceName.split(" ")[0]}%,model.ilike.%${deviceName}%`);

      if (vehicleError) {
        console.error("Error finding vehicle:", vehicleError);
        results.push({ vehicle: deviceName, status: "error", error: vehicleError.message });
        continue;
      }

      // Try to find a matching vehicle
      let matchedVehicle = vehicles?.find(v => {
        const fullName = `${v.make} ${v.model}`.toLowerCase();
        return fullName.includes(deviceName.toLowerCase()) || 
               deviceName.toLowerCase().includes(fullName);
      });

      if (!matchedVehicle && vehicles && vehicles.length > 0) {
        // Fuzzy match: check if device name contains make or model
        matchedVehicle = vehicles.find(v => 
          deviceName.toLowerCase().includes(v.make?.toLowerCase() || "") ||
          deviceName.toLowerCase().includes(v.model?.toLowerCase() || "")
        );
      }

      if (!matchedVehicle) {
        results.push({ vehicle: deviceName, status: "not_found", error: "No matching vehicle in system" });
        continue;
      }

      // Upsert mileage record
      const { error: upsertError } = await serviceClient
        .from("mileage_records")
        .upsert(
          {
            vehicle_id: matchedVehicle.id,
            record_date: recordDate,
            daily_mileage: dailyMileage,
            odometer_reading: odometerReading,
            source: "n8n_excel",
          },
          { onConflict: "vehicle_id,record_date" }
        );

      if (upsertError) {
        console.error("Error upserting mileage:", upsertError);
        results.push({ vehicle: deviceName, status: "error", error: upsertError.message });
      } else {
        results.push({ 
          vehicle: deviceName, 
          status: "success", 
          error: undefined 
        });
        console.log(`Imported mileage for ${deviceName}: ${dailyMileage} mi on ${recordDate}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Import complete", 
        results,
        processed: results.filter(r => r.status === "success").length,
        skipped: results.filter(r => r.status === "skipped").length,
        errors: results.filter(r => r.status === "error" || r.status === "not_found").length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error processing Excel file:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
