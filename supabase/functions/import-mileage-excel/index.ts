import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { read, utils } from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VehicleRow {
  Device: string;
  "Route Length": string;
  Mileage: string;
  "First Movement": string;
  "Last Stop": string;
}

// Input validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DAILY_MILEAGE = 2000;
const MAX_ODOMETER = 1000000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRATION_REGEX = /^[A-Z0-9\s]{1,15}$/i;

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if two strings are similar (allowing for typos)
function isSimilar(str1: string, str2: string, maxDistance = 2): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  if (Math.abs(s1.length - s2.length) <= maxDistance) {
    return levenshteinDistance(s1, s2) <= maxDistance;
  }
  
  return false;
}

// Validate mileage data
function validateMileageInput(dailyMileage: number, odometerReading: number | null, recordDate: string): string[] {
  const errors: string[] = [];
  
  if (dailyMileage < 0 || dailyMileage > MAX_DAILY_MILEAGE) {
    errors.push(`Daily mileage out of range (0-${MAX_DAILY_MILEAGE}): ${dailyMileage}`);
  }
  
  if (odometerReading !== null && (odometerReading < 0 || odometerReading > MAX_ODOMETER)) {
    errors.push(`Odometer reading out of range (0-${MAX_ODOMETER}): ${odometerReading}`);
  }
  
  if (!DATE_REGEX.test(recordDate)) {
    errors.push(`Invalid date format: ${recordDate}`);
  } else {
    const date = new Date(recordDate);
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (date > now || date < oneYearAgo) {
      errors.push(`Date out of acceptable range: ${recordDate}`);
    }
  }
  
  return errors;
}

Deno.serve(async (req) => {
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

    // SECURITY FIX: Require x-user-id header for ownership verification
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "x-user-id header is required for API key authentication" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: "Invalid user ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      fileBuffer = await file.arrayBuffer();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (!body.file_base64) {
        return new Response(
          JSON.stringify({ error: "No file_base64 provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Validate base64 length
      if (body.file_base64.length > MAX_FILE_SIZE * 1.4) { // Base64 is ~1.37x larger
        return new Response(
          JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const binaryString = atob(body.file_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    } else {
      fileBuffer = await req.arrayBuffer();
      if (fileBuffer.byteLength > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse the Excel file
    const workbook = read(new Uint8Array(fileBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const jsonData = utils.sheet_to_json<VehicleRow>(sheet, { range: 1 });
    
    // Limit rows to prevent abuse
    const maxRows = 500;
    if (jsonData.length > maxRows) {
      return new Response(
        JSON.stringify({ error: `Too many rows. Maximum is ${maxRows} rows.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY FIX: Verify the userId exists and only fetch vehicles belonging to this user
    const { data: userVehicles, error: userVehiclesError } = await serviceClient
      .from("vehicles")
      .select("id, registration, make, model, user_id")
      .eq("user_id", userId);

    if (userVehiclesError) {
      console.error("Error fetching user vehicles:", userVehiclesError);
      return new Response(
        JSON.stringify({ error: "Failed to verify user vehicles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userVehicles || userVehicles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No vehicles found for this user", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { vehicle: string; status: string; error?: string }[] = [];

    for (const row of jsonData) {
      const deviceName = row.Device;
      if (!deviceName || deviceName === "Device") continue;
      
      // Parse route length
      const routeLengthMatch = row["Route Length"]?.match(/^([\d.]+)/);
      const dailyMileage = routeLengthMatch ? Math.round(parseFloat(routeLengthMatch[1])) : 0;
      
      // Parse odometer mileage
      const mileageMatch = row["Mileage"]?.match(/^([\d.]+)/);
      const odometerReading = mileageMatch ? Math.round(parseFloat(mileageMatch[1])) : null;
      
      // Determine date
      let recordDate: string | null = null;
      const lastStop = row["Last Stop"];
      const firstMovement = row["First Movement"];
      
      if (lastStop) {
        recordDate = lastStop.split(" ")[0];
      } else if (firstMovement) {
        recordDate = firstMovement.split(" ")[0];
      }
      
      if (!recordDate) {
        recordDate = new Date().toISOString().split("T")[0];
      }

      // SECURITY FIX: Validate input data
      const validationErrors = validateMileageInput(dailyMileage, odometerReading, recordDate);
      if (validationErrors.length > 0) {
        results.push({ vehicle: deviceName, status: "validation_error", error: validationErrors.join("; ") });
        continue;
      }

      if (dailyMileage === 0 && !odometerReading) {
        results.push({ vehicle: deviceName, status: "skipped", error: "No mileage data" });
        continue;
      }

      // SECURITY FIX: Only match against user's own vehicles
      const deviceWords = deviceName.toLowerCase().split(/\s+/);
      
      const matchedVehicle = userVehicles.find(v => {
        const make = v.make?.toLowerCase() || "";
        const model = v.model?.toLowerCase() || "";
        const fullName = `${make} ${model}`;
        
        if (fullName === deviceName.toLowerCase()) return true;
        if (fullName.includes(deviceName.toLowerCase()) || 
            deviceName.toLowerCase().includes(fullName)) return true;
        
        const makeMatches = deviceWords.some(word => isSimilar(word, make));
        const modelMatches = deviceWords.some(word => isSimilar(word, model));
        
        if (makeMatches && modelMatches) return true;
        
        for (const word of deviceWords) {
          if (isSimilar(word, make, 2)) {
            const modelWords = model.split(/\s+/);
            for (const mWord of modelWords) {
              if (deviceWords.some(dw => dw !== word && isSimilar(dw, mWord, 2))) {
                return true;
              }
            }
          }
        }
        
        return false;
      });

      if (!matchedVehicle) {
        results.push({ vehicle: deviceName, status: "not_found", error: "No matching vehicle in user's fleet" });
        continue;
      }

      // Double-check ownership (defense in depth)
      if (matchedVehicle.user_id !== userId) {
        results.push({ vehicle: deviceName, status: "unauthorized", error: "Vehicle does not belong to user" });
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
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Import complete", 
        results,
        processed: results.filter(r => r.status === "success").length,
        skipped: results.filter(r => r.status === "skipped").length,
        errors: results.filter(r => ["error", "not_found", "validation_error", "unauthorized"].includes(r.status)).length
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
