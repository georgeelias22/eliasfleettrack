import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to parse dates from various formats
function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;
  
  if (typeof dateValue === "number") {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  } else if (typeof dateValue === "string") {
    // Try to parse string date
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    // Try DD/MM/YYYY format
    const ddmmyyyy = dateValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const date = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
    return null;
  }
  return null;
}

// Helper function to parse mileage values
function parseMileage(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  
  const mileage = typeof value === "number" 
    ? value 
    : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  
  if (isNaN(mileage) || mileage < 0) return null;
  return mileage;
}

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

    const firstRow = rows[0] as Record<string, unknown>;
    const columnNames = Object.keys(firstRow);
    
    console.log("Excel columns found:", columnNames);
    console.log("First row sample:", JSON.stringify(firstRow).substring(0, 500));
    console.log("Your vehicles:", vehicles?.map(v => v.registration).join(", "));

    // Process records
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Detect format: Row-based (each row = one vehicle's daily data) or Column-based (each column = a vehicle)
    // Row-based format has columns like: Vehicle/Registration, Date, Mileage/Distance
    // Column-based format has vehicle registrations as column headers
    
    const lowerColumns = columnNames.map(c => c.toLowerCase());
    const hasVehicleColumn = lowerColumns.some(c => 
      c.includes("vehicle") || c.includes("registration") || c.includes("reg") || c.includes("vrn")
    );
    const hasMileageColumn = lowerColumns.some(c => 
      c.includes("mileage") || c.includes("distance") || c.includes("miles") || c.includes("km")
    );
    const hasDateColumn = lowerColumns.some(c => 
      c.includes("date") || c.includes("day")
    );

    // Check for column-based format (vehicle registrations as headers)
    const regColumns = columnNames.filter((col) => {
      const normalizedCol = col.replace(/\s+/g, "").toUpperCase();
      return vehicleMap.has(normalizedCol);
    });

    console.log(`Format detection - hasVehicleColumn: ${hasVehicleColumn}, hasMileageColumn: ${hasMileageColumn}, hasDateColumn: ${hasDateColumn}, regColumns: ${regColumns.length}`);

    if (regColumns.length > 0) {
      // Column-based format: registrations are column headers
      console.log(`Using column-based format with ${regColumns.length} vehicle columns: ${regColumns.join(", ")}`);
      
      // Auto-detect date column
      let detectedDateColumn = dateColumn;
      if (!columnNames.includes(detectedDateColumn)) {
        const possibleDateColumns = columnNames.filter(col => 
          col.toLowerCase().includes("date") || 
          col.toLowerCase().includes("day") ||
          !vehicleMap.has(col.replace(/\s+/g, "").toUpperCase())
        );
        detectedDateColumn = possibleDateColumns[0] || columnNames[0];
      }
      console.log(`Date column: ${detectedDateColumn}`);

      for (const row of rows) {
        try {
          const rowData = row as Record<string, unknown>;
          const dateValue = rowData[detectedDateColumn];
          
          if (!dateValue) {
            results.skipped++;
            continue;
          }

          const recordDate = parseDate(dateValue);
          if (!recordDate) {
            results.skipped++;
            continue;
          }

          for (const regColumn of regColumns) {
            const mileageValue = rowData[regColumn];
            if (mileageValue === undefined || mileageValue === null || mileageValue === "") {
              continue;
            }

            const dailyMileage = parseMileage(mileageValue);
            if (dailyMileage === null) continue;

            const normalizedReg = regColumn.replace(/\s+/g, "").toUpperCase();
            const vehicleId = vehicleMap.get(normalizedReg);
            if (!vehicleId) continue;

            const { error: upsertError } = await supabase
              .from("mileage_records")
              .upsert(
                {
                  vehicle_id: vehicleId,
                  record_date: recordDate,
                  daily_mileage: Math.round(dailyMileage),
                  source: "n8n-excel",
                },
                { onConflict: "vehicle_id,record_date" }
              );

            if (upsertError) {
              results.errors.push(`Failed: ${regColumn} on ${recordDate}`);
              results.skipped++;
            } else {
              results.imported++;
            }
          }
        } catch (rowError) {
          results.skipped++;
        }
      }
    } else if (hasVehicleColumn && hasMileageColumn) {
      // Row-based format: each row has vehicle registration and mileage
      console.log("Using row-based format (vehicle + mileage columns)");
      
      // Find the relevant columns
      const vehicleCol = columnNames.find(c => {
        const lower = c.toLowerCase();
        return lower.includes("vehicle") || lower.includes("registration") || lower.includes("reg") || lower.includes("vrn");
      })!;
      
      const mileageCol = columnNames.find(c => {
        const lower = c.toLowerCase();
        return lower.includes("mileage") || lower.includes("distance") || lower.includes("miles") || lower.includes("km");
      })!;
      
      const dateCol = columnNames.find(c => {
        const lower = c.toLowerCase();
        return lower.includes("date") || lower.includes("day");
      });

      console.log(`Columns detected - Vehicle: ${vehicleCol}, Mileage: ${mileageCol}, Date: ${dateCol || "not found"}`);

      for (const row of rows) {
        try {
          const rowData = row as Record<string, unknown>;
          const vehicleReg = String(rowData[vehicleCol] || "").replace(/\s+/g, "").toUpperCase();
          const vehicleId = vehicleMap.get(vehicleReg);
          
          if (!vehicleId) {
            results.skipped++;
            continue;
          }

          const mileageValue = rowData[mileageCol];
          const dailyMileage = parseMileage(mileageValue);
          if (dailyMileage === null) {
            results.skipped++;
            continue;
          }

          // Use date column if available, otherwise use today
          let recordDate: string;
          if (dateCol && rowData[dateCol]) {
            const parsed = parseDate(rowData[dateCol]);
            recordDate = parsed || new Date().toISOString().split("T")[0];
          } else {
            recordDate = new Date().toISOString().split("T")[0];
          }

          const { error: upsertError } = await supabase
            .from("mileage_records")
            .upsert(
              {
                vehicle_id: vehicleId,
                record_date: recordDate,
                daily_mileage: Math.round(dailyMileage),
                source: "n8n-excel",
              },
              { onConflict: "vehicle_id,record_date" }
            );

          if (upsertError) {
            results.errors.push(`Failed: ${vehicleReg} - ${upsertError.message}`);
            results.skipped++;
          } else {
            results.imported++;
          }
        } catch (rowError) {
          results.skipped++;
        }
      }
    } else {
      // Unknown format - return helpful error
      return new Response(
        JSON.stringify({ 
          error: "Could not detect Excel format",
          available_columns: columnNames,
          first_row_sample: Object.fromEntries(
            Object.entries(firstRow).slice(0, 5).map(([k, v]) => [k, String(v).substring(0, 50)])
          ),
          your_vehicles: vehicles?.map(v => v.registration) || [],
          hint: "Excel should have either: (A) vehicle registrations as column headers with dates in rows, OR (B) columns for Vehicle/Registration, Mileage/Distance, and optionally Date"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
