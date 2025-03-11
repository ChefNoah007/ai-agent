import { json } from "@remix-run/node";
import { getVoiceflowSettings } from "../../utils/voiceflow-settings.server";

/**
 * Public API endpoint to fetch Voiceflow settings
 * This will be used by the frontend JavaScript in the shop to get the Voiceflow credentials
 */
export async function loader({ request }) {
  try {
    // Fetch the Voiceflow settings from metafields
    const settings = await getVoiceflowSettings(request);
    
    // Return the settings as JSON with appropriate cache headers and CORS headers
    return json(settings, {
      headers: {
        "Cache-Control": "public, max-age=60", // Cache for 1 minute
        "Access-Control-Allow-Origin": "*", // Allow access from any origin
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
    });
  } catch (error) {
    console.error("Error fetching Voiceflow settings:", error);
    return json(
      { error: "Failed to fetch Voiceflow settings" },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*", // Allow access from any origin
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}
