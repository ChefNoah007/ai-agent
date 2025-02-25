/**
 * Helper function to fetch Voiceflow settings from Shopify metafields
 * This function is used by various routes that need to access the Voiceflow API
 */

import { authenticate } from "../shopify.server";

// Default values in case the metafields don't exist or can't be fetched
const DEFAULT_SETTINGS = {
  vf_key: "VF.DM.670508f0cd8f2c59f1b534d4.t6mfdXeIfuUSTqUi",
  vf_project_id: "6703af9afcd0ea507e9c5369",
  vf_version_id: "6703af9afcd0ea507e9c536a"
};

/**
 * Fetches Voiceflow settings from Shopify metafields
 * @param {Request} request - The request object from the loader/action
 * @returns {Promise<Object>} - The Voiceflow settings
 */
export async function getVoiceflowSettings(request) {
  try {
    // Authenticate with Shopify admin API
    const { admin } = await authenticate.admin(request);

    // Fetch the Voiceflow settings from metafields
    const response = await admin.graphql(
      `query {
        shop {
          metafield(namespace: "voiceflow_settings", key: "api_credentials") {
            value
          }
        }
      }`
    );

    const responseJson = await response.json();
    const metafield = responseJson.data.shop.metafield;
    
    // If the metafield exists, parse the JSON value
    if (metafield) {
      try {
        const settings = JSON.parse(metafield.value);
        return {
          vf_key: settings.vf_key || DEFAULT_SETTINGS.vf_key,
          vf_project_id: settings.vf_project_id || DEFAULT_SETTINGS.vf_project_id,
          vf_version_id: settings.vf_version_id || DEFAULT_SETTINGS.vf_version_id
        };
      } catch (e) {
        console.error("Error parsing metafield value:", e);
      }
    }

    // Return default settings if metafield doesn't exist or can't be parsed
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error fetching Voiceflow settings:", error);
    return DEFAULT_SETTINGS;
  }
}