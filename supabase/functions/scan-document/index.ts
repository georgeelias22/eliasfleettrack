import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maximum characters to send to AI (roughly 200k tokens = ~800k chars for safety margin)
const MAX_CONTENT_LENGTH = 500000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Check if content is too large (base64 images can be huge)
    let processedContent = fileContent;
    let isImage = false;
    
    if (fileContent.startsWith('data:image/')) {
      isImage = true;
      // For images, we'll use multimodal capabilities with the image URL
      // But first check if it's not too large
      if (fileContent.length > MAX_CONTENT_LENGTH * 2) {
        return new Response(
          JSON.stringify({ 
            error: "Image file is too large for AI processing. Please upload a smaller image (under 5MB) or use a PDF/text document instead.",
            userMessage: true 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // For text content, truncate if needed
      if (fileContent.length > MAX_CONTENT_LENGTH) {
        processedContent = fileContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated due to length...]";
        console.log(`Content truncated from ${fileContent.length} to ${MAX_CONTENT_LENGTH} characters`);
      }
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

If you cannot determine a value, use null. Always try to extract as much information as possible.`;

    // Build messages based on content type
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isImage) {
      // Use multimodal message for images
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Please analyze this service document image (${fileName}) and extract the cost and service information:` },
          { type: "image_url", image_url: { url: processedContent } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Please analyze this document (${fileName}):\n\n${processedContent}`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment.", userMessage: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits.", userMessage: true }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorText.includes("context length") || errorText.includes("too many tokens")) {
        return new Response(
          JSON.stringify({ error: "Document is too large to process. Please try a smaller file.", userMessage: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
