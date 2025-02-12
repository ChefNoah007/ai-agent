import { json } from "@remix-run/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "../db.server.cjs";

// Konfiguration der Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: process.env.SHOPIFY_APP_URL,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  sessionStorage: new PrismaSessionStorage(prisma),
});

export async function loader({ request }) {
  const shopDomain = "coffee-principles.myshopify.com";
  // Verwende hier shopify.sessionStorage (nicht shopify.config.sessionStorage)
  const offlineSessionId = shopify.session.getOfflineId(shopDomain);
  const session = await shopify.sessionStorage.loadSession(offlineSessionId);
  if (!session) {
    return json({ success: false, error: `No offline session found for shop ${shopDomain}` }, { status: 500 });
  }
  
  // Erstelle den REST-Client mit der geladenen Session
  const client = new shopify.clients.Rest({ session });
  
  // Hole das Metafield aus dem Shop, das deine globalen Einstellungen enthält
  const response = await client.get({
    path: "metafields",
    query: {
      namespace: "ai_agents_einstellungen",
      key: "global"
    }
  });
  
  const metafields = response.body.metafields;
  let settings = null;
  if (metafields && metafields.length > 0) {
    const metafield = metafields[0];
    try {
      settings = JSON.parse(metafield.value);
    } catch (error) {
      settings = null;
    }
  }
  
  // Falls noch kein Metafield existiert, gebe Standardwerte zurück
  if (!settings) {
    settings = {
      hide_on_desktop: false,
      hide_on_mobile: false,
      page_slug: "none",
      bot_background_colour: "#FFFFFF",
      bot_text_colour: "#1A1E23",
      user_background_colour: "#FECF02",
      user_text_colour: "#FFFAE5",
      chat_heading: "KI-Beratung",
      send_label: "Abschicken",
      type_here_label: "Tippe hier dein Anliegen ein ...",
      outer_radius: 0,
      chat_bubble_radius: 0,
      input_button_radius: 0
    };
  }
  
  return json({ success: true, settings });
}
