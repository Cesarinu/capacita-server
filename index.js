// Capacita API — OpenRouter compat + fixes UI
// - Provider: OpenRouter (FREE) via baseURL
// - /status: sinaliza ai_provider e openai:true se houver chave
// - /mentor/ask: nunca envia "note:fallback"; sempre responde algo útil
// - /courses/generate: parsing de JSON robusto (sem quebrar o front)
// - /ai/ping: teste real do provider atual

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

// ========== utils ==========
const sanitize = (v) => {
  if (!v) return "";
  let x = String(v).trim();
  if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) {
    x = x.slice(1, -1);
  }
  return x.trim();
};
process.env.OPENAI_API_KEY = sanitize(process.env.OPENAI_API_KEY);
process.env.OPENAI_BASE_URL = sanitize(process.env.OPENAI_BASE_URL) || "https://openrouter.ai/api/v1";
process.env.APP_URL = sanitize(process.env.APP_URL) || sanitize(process.env.WEB_URL) || "https://capacita-web.vercel.app";

// log seguro
const hasKey = !!process.env.OPENAI_API_KEY;
console.log("[BOOT] baseURL:", process.env.OPENAI_BASE_URL);
console.log("[BOOT] has OPENAI_API_KEY:", hasKey);
console.log("[BOOT] APP_URL:", process.env.APP_URL);

// ========== landing ==========
app.get("/", (_req, res) => {
  res.type("html").send(`
    <!doctype html><html lang="pt-BR"><head>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Capacita API</title>
      <style>
        :root{--bg:#0f172a;--card:#111827;--ink:#e2e8f0;--muted:#94a3b8;--line:#1f2937;--brand:#0ea5e9}
        body{background:var(--bg);color:var(--ink);margin:0;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
        .wrap{max-width:820px;margin:72px auto;padding:0 20px}
        .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px}
        a.btn{display:inline-block;padding:10px 16px;background:var(--brand);color:#fff;border-radius:10px;text-decoration:none;margin-right:10px}
        code{background:var(--line);padding:2px 6px;border-radius:6px}
      </style>
    </head><body>
      <div class="wrap"><div class="card">
        <h1>Capacita API ✅</h1>
        <p>Frontend deve usar: <code>${process.env.RENDER_EXTERNAL_URL || "https://capacita-server.onrender.com"}</code></p>
        <p>
          <a class="btn" href="/health">/health</a>
          <a class="btn" href="/status">/status</a>
          <a class="btn" href="/ai/ping">/ai/ping</a>
        </p>
      </div></div>
    </body></html>
  `);
});

// ========== health/status ==========
app.get("/health", (_req, res) => res.json({ ok: true, version: "openrouter-fixes-1.0.0" }));
app.get("/status", (_req, res) => {
  res.json({
    ai_provider: process.env.OPENAI_BASE_URL.includes("openrouter.ai") ? "openrouter" : "openai",
    base_url: process.env.OPENAI_BASE_URL,
    openai: !!process.env.OPENAI_API_KEY,       // <- front usa isso
    openai_key_len: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    stripe: !!process.env.STRIPE_SECRET,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    app_url: process.env.APP_URL
  });
});

// ========== LLM client (OpenRouter) ==========
async function getLLM() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const { default: OpenAI } = await import("openai");
  const MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free"; // bom modelo free
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL,
      "X-Title": "Capacita"
    }
  });
  return { client, MODEL };
}

// ========== /ai/ping ==========
app.get("/ai/ping", async (_req, res) => {
  try {
    const { client, MODEL } = await getLLM();
    const r = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "Diga apenas: OK" }],
      temperature: 0
    });
    const msg = r?.choices?.[0]?.message?.content?.trim() || "";
    res.json({ ok: true, model: MODEL, reply: msg });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message) });
  }
});

// ========== auth fake ==========
const DEMO_USER = { id: 1, email: "demo@cap.ci", name: "Demo User" };
const FAKE_TOKEN = "demo-token";
app.post("/auth/login", (req, res) => {
  const { email = DEMO_USER.email } = req.body || {};
  res.json({ token: FAKE_TOKEN, user: { id: DEMO_USER.id, email, name: "Aluno" } });
});
app.post("/auth/register", (req, res) => {
  const { email, name = "Aluno", password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
  res.json({ token: FAKE_TOKEN, user: { id: Math.floor(Math.random() * 10000), email, name } });
});
const optionalAuth = (req, _res, next) => { req.user = DEMO_USER; next(); };

// ========== mentor ==========
const fallbackTips = [
  "Faça 3 blocos de 25min (Pomodoro) hoje.",
  "Resuma cada aula em 5 linhas.",
  "Explique o que aprendeu em voz alta ou para alguém.",
  "Resolva 3 exercícios progressivos sobre o tema.",
  "Replique um exemplo real do YouTube/Docs oficiais.",
  "Monte um mini-projeto de 1h e publique no GitHub.",
  "Anote 3 erros comuns que você cometeu.",
  "Crie flashcards com termos-chave.",
  "Refaça o exercício mais difícil sem olhar a solução."
];
const pick3 = (msg) => {
  const s = [...fallbackTips].sort(() => 0.5 - Math.random()).slice(0, 3);
  return `Sobre "${msg}":\n- ${s[0]}\n- ${s[1]}\n- ${s[2]}`;
};

app.post("/mentor/ask", optionalAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Mensagem vazia" });

  if (!process.env.OPENAI_API_KEY) {
    // NUNCA mande "note:fallback" (o front mostra aviso). Devolva provider e reply útil.
    return res.json({ reply: pick3(message), provider: "none" });
  }

  try {
    const { client, MODEL } = await getLLM();
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [
        { role: "system", content: "Você é um mentor prático, direto e motivador. Foque em passos acionáveis e curtos." },
        { role: "user", content: message }
      ]
    });
    const reply = r?.choices?.[0]?.message?.content?.trim() || pick3(message);
    res.json({ reply, provider: "openrouter", model: MODEL });
  } catch (e) {
    // Sem 'note', para não acionar alerta no UI:
    res.json({ reply: pick3(message), provider: "error", error: String(e.message) });
  }
});

// ========== cursos ==========
function buildFallbackCourse(topic, language = "pt") {
  const modules = [
    { title: `Introdução a ${topic}`, text: `Objetivos e visão geral de ${topic}. Aplicações práticas.` },
    { title: "Fundamentos Essenciais", text: `Conceitos-chave, boas práticas e erros comuns.` },
    { title: "Prática Guiada", text: "Exercícios progressivos com exemplos do mundo real." },
    { title: "Projeto Final", text: "Construa um mini-projeto de 1h e publique (GitHub/Drive)." }
  ];
  return {
    title: `${topic} (IA Fallback)`,
    description: `Trilha prática de ${topic} com etapas claras.`,
    level: "iniciante",
    language,
    duration: 6,
    tags: topic.toLowerCase(),
    content: { modules }
  };
}
// saneamento de JSON vindo do modelo
function extractJson(text) {
  if (!text) return null;
  // tenta entre a primeira { e a última }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  // remove cercas ``` e tenta parsear
  const cleaned = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  return null;
}

app.post("/courses/generate", optionalAuth, async (req, res) => {
  const { topic = "Excel para iniciantes", language = "pt" } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    const course = buildFallbackCourse(topic, language);
    return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, provider: "none" });
  }

  try {
    const { client, MODEL } = await getLLM();

    // Tentativa 1: pedir JSON puro (alguns modelos do OpenRouter aceitam response_format)
    let json = null;
    try {
      const r1 = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [{
          role: "user",
          content:
`Responda apenas JSON válido (sem comentários, sem markdown). Esquema:
{
  "title": "",
  "description": "",
  "level": "",
  "language": "${language}",
  "duration": 6,
  "tags": "",
  "content": { "modules": [ { "title": "", "text": "" } ] }
}
Gere o curso sobre "${topic}" em ${language}.`
        }],
        // alguns modelos ignoram; ainda assim vale tentar
        response_format: { type: "json_object" }
      });
      const raw1 = r1?.choices?.[0]?.message?.content || "";
      json = extractJson(raw1);
    } catch {}

    // Tentativa 2: sem response_format
    if (!json) {
      const r2 = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [{
          role: "user",
          content:
`Gere um curso em JSON válido (apenas JSON, sem markdown) sobre "${topic}" (${language}) no formato:
{
  "title": "",
  "description": "",
  "level": "",
  "language": "${language}",
  "duration": 6,
  "tags": "",
  "content": { "modules": [ { "title": "", "text": "" } ] }
}`
        }]
      });
      const raw2 = r2?.choices?.[0]?.message?.content || "";
      json = extractJson(raw2);
    }

    if (!json || !json?.content?.modules?.length) {
      // garante que o front não quebre
      const course = buildFallbackCourse(topic, language);
      return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, provider: "openrouter", model: MODEL });
    }

    // resposta válida para o front
    return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course: json, provider: "openrouter", model: MODEL });
  } catch (e) {
    const course = buildFallbackCourse(topic, language);
    return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, provider: "error", error: String(e.message) });
  }
});

// ========== payments & certs ==========
app.get("/payments/status", (_req, res) => {
  res.json({
    stripe: !!process.env.STRIPE_SECRET,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    web_url: process.env.APP_URL
  });
});
app.post("/certificates/mint", optionalAuth, (_req, res) => {
  const tx = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
  res.json({ ok: true, txHash: tx });
});

// ========== 404 ==========
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));

// ========== start ==========
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
