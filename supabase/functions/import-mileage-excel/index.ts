import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
    const dateColumnParam = url.searchParams.get("date_column") || "Date";

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

    let rows: Record<string, unknown>[] = [];
    let dateColumn = dateColumnParam;

    const contentType = req.headers.get("content-type") || "";

    // Handle different content types
    if (contentType.includes("multipart/form-data")) {
      // Handle form-data with file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided in form-data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet);
      
      console.log(`Parsed Excel file: ${file.name}, ${rows.length} rows`);
    } else if (contentType.includes("application/json")) {
      // Handle pre-parsed JSON
      const body = await req.json();
      
      if (body.rows && Array.isArray(body.rows)) {
        rows = body.rows;
        dateColumn = body.date_column || dateColumn;
      } else if (body.file_base64) {
        // Handle base64 encoded file
        const binaryString = atob(body.file_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const workbook = XLSX.read(bytes, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet);
        
        console.log(`Parsed base64 Excel, ${rows.length} rows`);
      } else {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body. Expected 'rows' array or 'file_base64'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Try to parse as raw binary Excel file
      try {
        const arrayBuffer = await req.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet);
        
        console.log(`Parsed raw binary Excel, ${rows.length} rows`);
      } catch (parseError) {
        console.error("Failed to parse as Excel:", parseError);
        return new Response(
          JSON.stringify({ 
            error: "Could not parse request. Send Excel file as form-data, base64 JSON, or raw binary.",
            hint: "For n8n, use form-data with 'file' field set to the binary attachment"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No data rows found in file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-detect date column if not found
    const firstRow = rows[0] as Record<string, unknown>;
    const columnNames = Object.keys(firstRow);
    
    if (!columnNames.includes(dateColumn)) {
      // Try to find a date-like column
      const possibleDateColumns = columnNames.filter(col => 
        col.toLowerCase().includes("date") || 
        col.toLowerCase().includes("day") ||
        col.toLowerCase() === "a" // Often first column in trackers
      );
      
      if (possibleDateColumns.length > 0) {
        dateColumn = possibleDateColumns[0];
        console.log(`Auto-detected date column: ${dateColumn}`);
      } else {
        dateColumn = columnNames[0]; // Use first column as fallback
        console.log(`Using first column as date: ${dateColumn}`);
      }
    }

    // Find registration columns (columns that match vehicle registrations)
    const regColumns = columnNames.filter((col) => {
      if (col === dateColumn) return false;
      const normalizedCol = col.replace(/\s+/g, "").toUpperCase();
      return vehicleMap.has(normalizedCol);
    });

    console.log(`Found ${regColumns.length} vehicle columns: ${regColumns.join(", ")}`);

    if (regColumns.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No vehicle registration columns found in file",
          available_columns: columnNames,
          your_vehicles: vehicles?.map(v => v.registration) || [],
          hint: "Column headers should match your vehicle registrations"
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
        const rowData = row as Record<string, unknown>;
        const dateValue = rowData[dateColumn];
        
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
          const mileageValue = rowData[regColumn];
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
        date_column_used: dateColumn,
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
