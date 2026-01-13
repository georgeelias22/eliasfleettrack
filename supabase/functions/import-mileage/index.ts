import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation constants
const MAX_DAILY_MILEAGE = 2000;
const MAX_ODOMETER = 1000000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRATION_REGEX = /^[A-Z0-9\s]{1,15}$/i;

interface MileagePayload {
  registration: string;
  daily_mileage: number;
  record_date?: string;
  odometer_reading?: number;
}

function validateMileagePayload(payload: MileagePayload): string[] {
  const errors: string[] = [];
  
  // Registration validation
  if (!payload.registration || typeof payload.registration !== 'string') {
    errors.push('registration is required and must be a string');
  } else if (!REGISTRATION_REGEX.test(payload.registration.replace(/\s+/g, ''))) {
    errors.push('Invalid registration format');
  } else if (payload.registration.length > 15) {
    errors.push('Registration too long (max 15 characters)');
  }
  
  // Daily mileage validation
  if (payload.daily_mileage === undefined || payload.daily_mileage === null) {
    errors.push('daily_mileage is required');
  } else if (typeof payload.daily_mileage !== 'number' || isNaN(payload.daily_mileage)) {
    errors.push('daily_mileage must be a number');
  } else if (payload.daily_mileage < 0 || payload.daily_mileage > MAX_DAILY_MILEAGE) {
    errors.push(`daily_mileage must be between 0 and ${MAX_DAILY_MILEAGE}`);
  }
  
  // Record date validation (optional)
  if (payload.record_date !== undefined) {
    if (typeof payload.record_date !== 'string') {
      errors.push('record_date must be a string');
    } else if (!DATE_REGEX.test(payload.record_date)) {
      errors.push('record_date must be in YYYY-MM-DD format');
    } else {
      const date = new Date(payload.record_date);
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (isNaN(date.getTime())) {
        errors.push('record_date is not a valid date');
      } else if (date > now) {
        errors.push('record_date cannot be in the future');
      } else if (date < oneYearAgo) {
        errors.push('record_date cannot be more than 1 year ago');
      }
    }
  }
  
  // Odometer reading validation (optional)
  if (payload.odometer_reading !== undefined && payload.odometer_reading !== null) {
    if (typeof payload.odometer_reading !== 'number' || isNaN(payload.odometer_reading)) {
      errors.push('odometer_reading must be a number');
    } else if (payload.odometer_reading < 0 || payload.odometer_reading > MAX_ODOMETER) {
      errors.push(`odometer_reading must be between 0 and ${MAX_ODOMETER}`);
    }
  }
  
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT and get the authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    // Parse and validate payload
    let payload: MileagePayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY FIX: Comprehensive input validation
    const validationErrors = validateMileagePayload(payload);
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { registration, daily_mileage, record_date, odometer_reading } = payload;

    // Use service role client for database operations (RLS bypass)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find vehicle by registration and verify ownership using authenticated user's ID
    const normalizedReg = registration.replace(/\s+/g, '').toUpperCase();
    const { data: vehicle, error: vehicleError } = await serviceClient
      .from('vehicles')
      .select('id, user_id, registration')
      .eq('user_id', userId) // SECURITY FIX: Filter by user_id in query
      .ilike('registration', `%${normalizedReg}%`)
      .single();

    if (vehicleError || !vehicle) {
      return new Response(
        JSON.stringify({ error: `Vehicle not found or does not belong to user: ${registration}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY FIX: Double-check ownership (defense in depth)
    if (vehicle.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: vehicle does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recordDate = record_date || new Date().toISOString().split('T')[0];

    // Upsert mileage record (update if date exists, insert if not)
    const { data: mileageRecord, error: insertError } = await serviceClient
      .from('mileage_records')
      .upsert({
        vehicle_id: vehicle.id,
        record_date: recordDate,
        daily_mileage: Math.round(daily_mileage), // Ensure integer
        odometer_reading: odometer_reading ? Math.round(odometer_reading) : null,
        source: 'zapier'
      }, {
        onConflict: 'vehicle_id,record_date'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting mileage record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save mileage record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mileage record imported',
        record: mileageRecord 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing mileage import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
