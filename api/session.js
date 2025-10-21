// /api/session.js
// Env vars: OPENAI_API_KEY, WORKFLOW_ID
// Tip: add your production & preview domains in OpenAI's domain allowlist for ChatKit.

const allowOrigin = (req) =>
  req.headers.origin &&
  /^(https:\/\/(?:.+\.)?apluz\.vercel\.app|http:\/\/localhost:\d+)$/.test(req.headers.origin)
    ? req.headers.origin
    : "https://apluz.vercel.app";

const CORS = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

export default async function handler(req, res) {
  const origin = allowOrigin(req);
  const setCORS = () => {
    const h = CORS(origin);
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  };

  if (req.method === "OPTIONS") {
    setCORS();
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    setCORS();
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const workflowId = process.env.WORKFLOW_ID;
    if (!apiKey || !workflowId) throw new Error("Missing OPENAI_API_KEY or WORKFLOW_ID");

    // Create ChatKit session — IMPORTANT: include OpenAI-Beta header
    const r = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        // optional: user identity you want inside the workflow
        // user: { id: "anon-user" }
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("OpenAI session error:", text);
      throw new Error(text);
    }
    const data = JSON.parse(text); // { client_secret, ... }

    setCORS();
    return res.status(200).json({ client_secret: data.client_secret });
  } catch (err) {
    console.error(err);
    setCORS();
    return res.status(500).json({ error: String(err.message || err) });
  }
}
