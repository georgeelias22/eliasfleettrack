import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MileagePayload {
  registration: string;
  daily_mileage: number;
  record_date?: string;
  odometer_reading?: number;
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
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: MileagePayload = await req.json();
    console.log('Received mileage payload for user:', userId, payload);

    const { registration, daily_mileage, record_date, odometer_reading } = payload;

    if (!registration || daily_mileage === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: registration, daily_mileage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (RLS bypass)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find vehicle by registration and verify ownership using authenticated user's ID
    const { data: vehicle, error: vehicleError } = await serviceClient
      .from('vehicles')
      .select('id, user_id')
      .ilike('registration', registration.replace(/\s+/g, ''))
      .single();

    if (vehicleError || !vehicle) {
      console.error('Vehicle not found:', registration);
      return new Response(
        JSON.stringify({ error: `Vehicle not found: ${registration}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authenticated user owns this vehicle
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
        daily_mileage: daily_mileage,
        odometer_reading: odometer_reading || null,
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

    console.log('Mileage record saved:', mileageRecord);

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
