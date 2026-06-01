export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight requests (allows your website to communicate with the worker)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 1. FRONTEND WEBSITE SENDS CODE HERE (POST)
    if (request.method === "POST" && url.pathname === "/send-code") {
      try {
        const data = await request.json();
        const sessionKey = data.key;
        const luauCode = data.code;

        if (!sessionKey || !luauCode) {
          return new Response("Missing key or code payload", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        // Save the raw text code into the KV Namespace using the session key
        await env.ROBLOX_QUEUE.put(sessionKey, luauCode);

        return new Response("Code successfully queued at the edge", {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response("Invalid JSON payload structure", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    // 2. ROBLOX CLIENT PICKS UP CODE HERE (GET)
    if (request.method === "GET" && url.pathname === "/get-code") {
      const sessionKey = url.searchParams.get("key");

      if (!sessionKey) {
        return new Response("Missing search query key parameter", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      // Fetch the queued script from the KV storage database
      const cachedCode = await env.ROBLOX_QUEUE.get(sessionKey);

      if (cachedCode) {
        // Automatically wipe the key after it's read once so it doesn't execute in a loop
        await env.ROBLOX_QUEUE.delete(sessionKey);
        
        return new Response(cachedCode, {
          status: 200,
          headers: { 
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
          }
        });
      }

      // Return an empty success response if no code is waiting
      return new Response("", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
    }

    // Fallback if someone hits an invalid path or method
    return new Response("Endpoint Not Found or Method Not Allowed", { 
      status: 404, 
      headers: { "Access-Control-Allow-Origin": "*" } 
    });
  },
};
