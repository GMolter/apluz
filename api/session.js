// /api/session.js
// Vercel serverless function that creates a ChatKit session
// Env vars required: OPENAI_API_KEY, WORKFLOW_ID

const CORS_HEADERS = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === "OPTIONS") {
    const h = CORS_HEADERS(req.headers.origin);
    Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    const h = CORS_HEADERS(req.headers.origin);
    Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const workflowId = process.env.WORKFLOW_ID;

    if (!apiKey || !workflowId) {
      throw new Error("Missing OPENAI_API_KEY or WORKFLOW_ID env var");
    }

    // Create a ChatKit session on OpenAI (server-side)
    const r = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        // optional: identify your user to your workflow
        // user: { id: "anon-user" }
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("OpenAI session error:", text);
      throw new Error(text);
    }

    const data = JSON.parse(text); // { client_secret, ... }

    // Return the short-lived client_secret to the browser
    const h = CORS_HEADERS(req.headers.origin);
    Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
    res.status(200).json({ client_secret: data.client_secret });
  } catch (err) {
    console.error(err);
    const h = CORS_HEADERS(req.headers.origin);
    Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
    res.status(500).json({ error: String(err.message || err) });
  }
}
