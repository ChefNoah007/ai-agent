import { json } from "@remix-run/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "../db.server.cjs";

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: process.env.SHOPIFY_APP_URL,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  sessionStorage: new PrismaSessionStorage(prisma),
});

export const action = async ({ request }) => {
  try {
    // Parse den Body, um das `overwrite`-Flag zu erhalten
    const body = await request.json();
    const overwrite = body.overwrite === true; // Standard ist false, wenn nicht übergeben

    const shopDomain = "coffee-principles.myshopify.com";
    const offlineSessionId = shopify.session.getOfflineId(shopDomain);

    const session = await shopify.config.sessionStorage.loadSession(offlineSessionId);
    if (!session) {
      throw new Error(`No offline session found for shop ${shopDomain}`);
    }

    const shopifyAPI = new shopify.clients.Rest({ session });

    let allProducts = [];
    let hasNextPage = true;
    let nextPageCursor = undefined;

    while (hasNextPage) {
      const { body, pageInfo } = await shopifyAPI.get({
        path: "products",
        query: {
          limit: 250,
          published_status: "published", // Nur aktive Produkte
          ...(nextPageCursor ? { page_info: nextPageCursor } : {}),
        },
      });
    
      allProducts = [...allProducts, ...body.products];
      nextPageCursor = pageInfo?.nextPage?.query.page_info;
      hasNextPage = Boolean(nextPageCursor);
    }    

    const normalizedItems = allProducts
  .filter((product) => product.status === "active") // Nur aktive Produkte
  .map((product) => ({
    ProductID: product.id.toString(),
    ProductName: product.title || "",
    ProductDescription: product.body_html
      ? product.body_html.replace(/<[^>]*>/g, "").replace(/[\r\n\t]+/g, " ").trim()
      : "No description available.",
    ProductURL: `https://${shopDomain}/products/${product.handle}`,
    ImageURL: product.images?.[0]?.src || "No Image Available",
    Tags: product.tags?.split(",") || [],
    Variants: product.variants.map((variant) => ({
      VariantID: variant.id.toString(),
      Title: variant.title || "Default",
      Price: variant.price || "N/A", // Setze "N/A" als Standardpreis
      InventoryQuantity: variant.inventory_quantity || 0,
      SKU: variant.sku || "No SKU",
      Weight: variant.weight || "N/A",
    })),
    ProductPrice: product.variants?.[0]?.price || "N/A", // "N/A" für fehlende Preise
  }));


    // Voiceflow URL mit optionalem `overwrite`
    let voiceflowUrl = "https://api.voiceflow.com/v1/knowledge-base/docs/upload/table";
    if (overwrite) {
      voiceflowUrl += "?overwrite=true";
    }

    const voiceflowData = {
      data: {
        schema: {
          searchableFields: [
            "ProductName",
            "ProductID",
            "ProductPrice", // Muss bei allen Produkten vorhanden sein
            "ProductDescription",
          ],
          metadataFields: ["ProductID", "ProductPrice", "ProductDescription"],
        },
        name: "ShopifyProducts",
        items: normalizedItems,
      },
    };

    const voiceflowResponse = await fetch(voiceflowUrl, {
      method: "POST",
      headers: {
        Authorization: "VF.DM.670508f0cd8f2c59f1b534d4.t6mfdXeIfuUSTqUi",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(voiceflowData),
    });

    if (voiceflowResponse.ok) {
      return json({ success: true });
    } else {
      const errorDetails = await voiceflowResponse.json();
      return json({ success: false, error: errorDetails });
    }
  } catch (error) {
    console.error("Synchronization error:", error);
    return json({ success: false, error: error.message });
  }
};
