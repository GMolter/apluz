// /api/session.js
export const config = { runtime: "edge" };

const BASE = "https://api.openai.com/v1";

async function openai(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2", // 🧩 Required header
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  return res.json();
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { message, threadId } = await req.json();
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    if (!process.env.ASSISTANT_ID) throw new Error("Missing ASSISTANT_ID");

    // 1️⃣ Create / reuse thread
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const thread = await openai("/threads", { method: "POST" });
      currentThreadId = thread.id;
    }

    // 2️⃣ Add user message
    await openai(`/threads/${currentThreadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "user", content: message }),
    });

    // 3️⃣ Run the assistant
    const run = await openai(`/threads/${currentThreadId}/runs`, {
      method: "POST",
      body: JSON.stringify({ assistant_id: process.env.ASSISTANT_ID }),
    });

    // 4️⃣ Poll until done
    let status = run.status;
    let safetyStop = 0;
    while ((status === "queued" || status === "in_progress") && safetyStop < 60) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await openai(`/threads/${currentThreadId}/runs/${run.id}`);
      status = check.status;
      safetyStop++;
    }

    if (status !== "completed") {
      return new Response(
        JSON.stringify({
          error: `Run status: ${status} (not completed)`,
          threadId: currentThreadId,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5️⃣ Fetch assistant’s last message
    const messages = await openai(`/threads/${currentThreadId}/messages`);
    const lastAssistant = messages.data.find((m) => m.role === "assistant");
    const text =
      lastAssistant?.content?.[0]?.text?.value ?? "(No response from assistant)";

    return new Response(
      JSON.stringify({ reply: text, threadId: currentThreadId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
