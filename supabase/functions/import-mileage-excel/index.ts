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

    // Get user's vehicles to map registrations AND make/model to vehicle IDs
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, registration, make, model")
      .eq("user_id", userId);

    if (vehiclesError) {
      console.error("Error fetching vehicles:", vehiclesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch vehicles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create maps for matching vehicles
    const vehicleMap = new Map<string, string>(); // registration -> id
    const vehicleMakeModelMap = new Map<string, string>(); // "make model" -> id
    
    vehicles?.forEach((v) => {
      // Map by registration (case-insensitive, no spaces)
      const normalizedReg = v.registration.replace(/\s+/g, "").toUpperCase();
      vehicleMap.set(normalizedReg, v.id);
      
      // Map by make + model combination for fuzzy matching
      if (v.make && v.model) {
        const makeModel = `${v.make} ${v.model}`.replace(/\s+/g, " ").toUpperCase().trim();
        vehicleMakeModelMap.set(makeModel, v.id);
      }
    });
    
    console.log("Vehicle make/models:", Array.from(vehicleMakeModelMap.keys()).join(", "));
    
    // Simple Levenshtein distance for fuzzy string matching
    function levenshtein(a: string, b: string): number {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          matrix[i][j] = b[i-1] === a[j-1] 
            ? matrix[i-1][j-1] 
            : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
        }
      }
      return matrix[b.length][a.length];
    }
    
    // Check if two strings are similar (allowing small typos)
    function isSimilar(a: string, b: string, threshold = 2): boolean {
      const distance = levenshtein(a.toUpperCase(), b.toUpperCase());
      // Allow up to 'threshold' character differences, or 15% of length for longer strings
      const maxAllowed = Math.max(threshold, Math.floor(Math.max(a.length, b.length) * 0.15));
      return distance <= maxAllowed;
    }
    
    // Helper function to find vehicle by device name using fuzzy matching
    function findVehicleByDeviceName(deviceName: string): string | undefined {
      const normalizedDevice = deviceName.replace(/\s+/g, "").toUpperCase();
      const deviceWords = deviceName.toUpperCase().split(/\s+/).filter(w => w.length > 1);
      
      // 1. Check if device name IS a registration
      let vehicleId = vehicleMap.get(normalizedDevice);
      if (vehicleId) return vehicleId;
      
      // 2. Check if registration is contained in device name
      for (const [reg, id] of vehicleMap.entries()) {
        if (normalizedDevice.includes(reg) || reg.includes(normalizedDevice)) {
          return id;
        }
      }
      
      // 3. Match against make + model (fuzzy with typo tolerance)
      for (const [makeModel, id] of vehicleMakeModelMap.entries()) {
        const makeModelNormalized = makeModel.replace(/\s+/g, "");
        const makeModelWords = makeModel.split(/\s+/);
        
        // Exact match on make+model
        if (normalizedDevice === makeModelNormalized) {
          return id;
        }
        
        // Check if device contains make+model or vice versa
        if (normalizedDevice.includes(makeModelNormalized) || makeModelNormalized.includes(normalizedDevice)) {
          return id;
        }
        
        // Fuzzy match with Levenshtein distance (handles typos like Peugot vs Peugeot)
        if (isSimilar(normalizedDevice, makeModelNormalized)) {
          console.log(`Fuzzy matched "${deviceName}" to "${makeModel}" (typo tolerance)`);
          return id;
        }
        
        // Check if all make/model words appear in device name (with typo tolerance)
        const allWordsMatch = makeModelWords.every(word => 
          deviceWords.some(dw => dw.includes(word) || word.includes(dw) || isSimilar(dw, word, 1))
        );
        if (allWordsMatch && makeModelWords.length >= 2) {
          return id;
        }
        
        // Check if device starts with similar make and contains part of model
        const makeWord = makeModelWords[0];
        if (deviceWords.length > 0 && isSimilar(deviceWords[0], makeWord, 1)) {
          // First word matches make (with typo tolerance), check if any model word matches
          const modelWords = makeModelWords.slice(1);
          const hasModelMatch = modelWords.some(mw => 
            deviceWords.some(dw => dw.includes(mw) || mw.includes(dw) || isSimilar(dw, mw, 1))
          );
          if (hasModelMatch) {
            return id;
          }
        }
      }
      
      return undefined;
    }

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

    // Check if first row is actually a header row (common in vehicle reports)
    // This happens when Excel has a title row that gets parsed as data
    const firstRowValues = Object.values(firstRow).map(v => String(v || "").toLowerCase());
    const isHeaderRow = firstRowValues.some(v => 
      v.includes("device") || v.includes("imei") || v.includes("mileage") || 
      v.includes("vehicle") || v.includes("registration")
    );
    
    // Build a column mapping from the header row
    let columnMapping: Record<string, string> = {};
    let dataRows = rows;
    
    if (isHeaderRow) {
      console.log("First row appears to be a header row, building column mapping");
      // Map __EMPTY columns to their actual header names
      for (const [key, value] of Object.entries(firstRow)) {
        if (value && typeof value === "string") {
          columnMapping[value.toLowerCase().trim()] = key;
        }
      }
      console.log("Column mapping:", JSON.stringify(columnMapping));
      // Skip the header row for data processing
      dataRows = rows.slice(1);
    }

    // Process records
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Check for "Vehicle Report" format: Device column + Mileage/Route Length column
    // The columnMapping maps lowercase header names to actual Excel column keys
    // e.g., columnMapping["device"] = "Vehicle Information" (the actual key in the row data)
    
    console.log("Column mapping keys:", Object.keys(columnMapping));
    
    // Find device column - check mapping first, then fall back to column names
    let deviceCol: string | undefined = columnMapping["device"];
    if (!deviceCol) {
      deviceCol = columnNames.find(c => c.toLowerCase().includes("device"));
    }
    
    // Find mileage column - check mapping for various names
    let mileageCol: string | undefined = columnMapping["mileage"] || 
                                          columnMapping["route length"] ||
                                          columnMapping["total mileage"] ||
                                          columnMapping["distance"];
    if (!mileageCol) {
      // Also check for __EMPTY columns that might contain mileage
      for (const [header, colKey] of Object.entries(columnMapping)) {
        if (header.includes("mileage") || header.includes("route") || header.includes("distance")) {
          mileageCol = colKey;
          break;
        }
      }
    }
    if (!mileageCol) {
      mileageCol = columnNames.find(c => c.toLowerCase().includes("mileage"));
    }
    
    console.log(`Device column: ${deviceCol}, Mileage column: ${mileageCol}`);
    
    // Try to extract date from filename embedded in request URL or use today
    let reportDate = new Date().toISOString().split("T")[0];
    
    // Try extracting date from rows if there's a date pattern in values
    if (dataRows.length > 0) {
      const sampleRow = dataRows[0] as Record<string, unknown>;
      for (const value of Object.values(sampleRow)) {
        if (typeof value === "string") {
          // Look for date patterns like "14-01-2026" in the data
          const dateMatch = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (dateMatch) {
            reportDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            console.log("Extracted date from data:", reportDate);
            break;
          }
        }
      }
    }

    if (deviceCol && mileageCol) {
      // Vehicle Report format detected
      console.log(`Detected Vehicle Report format - Device: ${deviceCol}, Mileage: ${mileageCol}`);
      console.log(`Using report date: ${reportDate}`);
      
      for (const row of dataRows) {
        try {
          const rowData = row as Record<string, unknown>;
          const deviceName = String(rowData[deviceCol] || "").trim();
          
          if (!deviceName) {
            results.skipped++;
            continue;
          }

          // Match device name to vehicle using fuzzy matching (registration or make/model)
          const vehicleId = findVehicleByDeviceName(deviceName);
          
          if (!vehicleId) {
            console.log(`No matching vehicle for device: ${deviceName}`);
            results.skipped++;
            continue;
          }
          
          console.log(`Matched device "${deviceName}" to vehicle ID ${vehicleId}`);

          const mileageValue = rowData[mileageCol];
          // Handle "Route Length" format like "123.45 km" or just a number
          let dailyMileage: number | null = null;
          
          if (typeof mileageValue === "number") {
            dailyMileage = mileageValue;
          } else if (typeof mileageValue === "string") {
            // Extract number from strings like "123.45 km" or "45.6 miles"
            const numMatch = mileageValue.match(/[\d.]+/);
            if (numMatch) {
              dailyMileage = parseFloat(numMatch[0]);
              // Convert km to miles if needed (assuming the value is in km based on "Route Length")
              if (mileageValue.toLowerCase().includes("km")) {
                dailyMileage = dailyMileage * 0.621371;
              }
            }
          }

          if (dailyMileage === null || isNaN(dailyMileage)) {
            results.skipped++;
            continue;
          }

          const { error: upsertError } = await supabase
            .from("mileage_records")
            .upsert(
              {
                vehicle_id: vehicleId,
                record_date: reportDate,
                daily_mileage: Math.round(dailyMileage),
                source: "n8n-excel",
              },
              { onConflict: "vehicle_id,record_date" }
            );

          if (upsertError) {
            results.errors.push(`Failed: ${deviceName} - ${upsertError.message}`);
            results.skipped++;
          } else {
            results.imported++;
          }
        } catch (rowError) {
          results.skipped++;
        }
      }
    } else {
      // Try original format detection
      const lowerColumns = columnNames.map(c => c.toLowerCase());
      const hasVehicleColumn = lowerColumns.some(c => 
        c.includes("vehicle") || c.includes("registration") || c.includes("reg") || c.includes("vrn")
      );
      const hasMileageColumn = lowerColumns.some(c => 
        c.includes("mileage") || c.includes("distance") || c.includes("miles") || c.includes("km")
      );

      // Check for column-based format (vehicle registrations as headers)
      const regColumns = columnNames.filter((col) => {
        const normalizedCol = col.replace(/\s+/g, "").toUpperCase();
        return vehicleMap.has(normalizedCol);
      });

      console.log(`Format detection - hasVehicleColumn: ${hasVehicleColumn}, hasMileageColumn: ${hasMileageColumn}, regColumns: ${regColumns.length}`);

      if (regColumns.length > 0) {
        // Column-based format: registrations are column headers
        console.log(`Using column-based format with ${regColumns.length} vehicle columns: ${regColumns.join(", ")}`);
        
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

        for (const row of dataRows) {
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
        // Row-based format
        console.log("Using row-based format (vehicle + mileage columns)");
        
        const vehicleCol = columnNames.find(c => {
          const lower = c.toLowerCase();
          return lower.includes("vehicle") || lower.includes("registration") || lower.includes("reg") || lower.includes("vrn");
        })!;
        
        const mileageColFound = columnNames.find(c => {
          const lower = c.toLowerCase();
          return lower.includes("mileage") || lower.includes("distance") || lower.includes("miles") || lower.includes("km");
        })!;
        
        const dateCol = columnNames.find(c => {
          const lower = c.toLowerCase();
          return lower.includes("date") || lower.includes("day");
        });

        console.log(`Columns detected - Vehicle: ${vehicleCol}, Mileage: ${mileageColFound}, Date: ${dateCol || "not found"}`);

        for (const row of dataRows) {
          try {
            const rowData = row as Record<string, unknown>;
            const vehicleReg = String(rowData[vehicleCol] || "").replace(/\s+/g, "").toUpperCase();
            const vehicleId = vehicleMap.get(vehicleReg);
            
            if (!vehicleId) {
              results.skipped++;
              continue;
            }

            const mileageValue = rowData[mileageColFound];
            const dailyMileage = parseMileage(mileageValue);
            if (dailyMileage === null) {
              results.skipped++;
              continue;
            }

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
            column_mapping: columnMapping,
            first_row_sample: Object.fromEntries(
              Object.entries(firstRow).slice(0, 8).map(([k, v]) => [k, String(v).substring(0, 50)])
            ),
            your_vehicles: vehicles?.map(v => v.registration) || [],
            hint: "Excel should have either: (A) vehicle registrations as column headers, (B) Device + Mileage columns (Vehicle Report format), OR (C) columns for Vehicle/Registration and Mileage/Distance"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Excel import results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${results.imported} records, skipped ${results.skipped}`,
        details: results,
        format_detected: deviceCol && mileageCol ? "vehicle_report" : "standard",
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
