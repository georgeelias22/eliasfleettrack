import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName } = await req.json();
    
    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: "File content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert document analyzer specializing in vehicle service records, invoices, and MOT certificates. 
    
Analyze the provided document content and extract the following information:
- Total cost/amount (in GBP)
- Service type (e.g., MOT, Oil Change, Tire Replacement, General Service, Repair, etc.)
- Service date (if visible)
- Provider/garage name
- Vehicle registration (if visible)
- Mileage (if visible)
- Description of work performed
- Any individual line items with their costs

Return the data as a JSON object with this structure:
{
  "totalCost": number or null,
  "serviceType": string or null,
  "serviceDate": "YYYY-MM-DD" or null,
  "provider": string or null,
  "registration": string or null,
  "mileage": number or null,
  "description": string or null,
  "lineItems": [{ "description": string, "cost": number }] or []
}

If you cannot determine a value, use null. Always try to extract as much information as possible.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please analyze this document (${fileName}):\n\n${fileContent}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract structured data from a vehicle service document",
              parameters: {
                type: "object",
                properties: {
                  totalCost: { type: "number", description: "Total cost in GBP" },
                  serviceType: { type: "string", description: "Type of service performed" },
                  serviceDate: { type: "string", description: "Date of service in YYYY-MM-DD format" },
                  provider: { type: "string", description: "Name of the service provider/garage" },
                  registration: { type: "string", description: "Vehicle registration number" },
                  mileage: { type: "number", description: "Vehicle mileage at time of service" },
                  description: { type: "string", description: "Description of work performed" },
                  lineItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        cost: { type: "number" }
                      }
                    }
                  }
                },
                required: ["totalCost", "serviceType"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to analyze document");
    }

    const data = await response.json();
    
    let extractedData = null;
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const functionArgs = toolCalls[0].function?.arguments;
      if (functionArgs) {
        extractedData = JSON.parse(functionArgs);
      }
    }

    if (!extractedData) {
      // Fallback: try to parse from content
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          extractedData = JSON.parse(content);
        } catch {
          extractedData = { description: content };
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scanning document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to scan document" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
