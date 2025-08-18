// Capacita API — OpenRouter (grátis)
// - Usa OpenRouter no lugar da OpenAI paga
// - Basta setar OPENAI_API_KEY (OpenRouter) e OPENAI_BASE_URL=https://openrouter.ai/api/v1
// - Mantém as rotas existentes: /ai/ping, /mentor/ask, /courses/generate

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

// ========== SANITIZAÇÃO ==========
function sanitize(v) {
  if (!v) return "";
  let x = String(v).trim();
  if (x.startsWith('"') && x.endsWith('"')) x = x.slice(1, -1);
  if (x.startsWith("'") && x.endsWith("'")) x = x.slice(1, -1);
  return x.trim();
}
process.env.OPENAI_API_KEY = sanitize(process.env.OPENAI_API_KEY);
process.env.OPENAI_BASE_URL = sanitize(process.env.OPENAI_BASE_URL) || "https://openrouter.ai/api/v1";
process.env.APP_URL = sanitize(process.env.APP_URL) || sanitize(process.env.WEB_URL) || "https://capacita-web.vercel.app";

// ===== BOOT LOGS (sem vazar segredo) =====
const hasKey = !!process.env.OPENAI_API_KEY;
const keyLen = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0;
const keyPrefix = process.env.OPENAI_API_KEY?.slice(0, 9) || "";
console.log("[BOOT] OPENAI_BASE_URL:", process.env.OPENAI_BASE_URL);
console.log("[BOOT] OPENAI_API_KEY:", hasKey ? `${keyPrefix}*** (len=${keyLen})` : "NÃO definida");
console.log("[BOOT] APP_URL:", process.env.APP_URL);

// ===== Landing =====
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
        <p>Use esta URL no frontend: <code>${process.env.RENDER_EXTERNAL_URL || "https://capacita-server.onrender.com"}</code></p>
        <p><a class="btn" href="/health">/health</a><a class="btn" href="/status">/status</a><a class="btn" href="/ai/ping">/ai/ping</a></p>
      </div></div>
    </body></html>
  `);
});

// ===== Health & Status =====
app.get("/health", (_req, res) => res.json({ ok: true, version: "openrouter-1.0.0" }));
app.get("/status", (_req, res) => {
  res.json({
    base_url: process.env.OPENAI_BASE_URL,
    openai: !!process.env.OPENAI_API_KEY,
    openai_key_len: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    stripe: !!process.env.STRIPE_SECRET,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    app_url: process.env.APP_URL
  });
});

// ===== Cliente OpenRouter (usa SDK openai com baseURL) =====
async function getLLM() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const { default: OpenAI } = await import("openai");
  // Modelos grátis do OpenRouter variam — definimos um padrão e deixamos override por env
  const MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1:free";
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    // Cabeçalhos recomendados pelo OpenRouter (não obrigatórios, mas ajudam)
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL,   // para rate limits mais generosos
      "X-Title": "Capacita"
    }
  });
  return { client, MODEL };
}

// ===== Teste real =====
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

// ===== Auth fake =====
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

// ===== Mentor =====
const fallbackTips = [
  "Faça 3 blocos de 25min (Pomodoro) hoje.",
  "Resuma cada aula em 5 linhas.",
  "Explique o que aprendeu em voz alta ou para alguém.",
  "Resolva 3 exercícios progressivos sobre o tema.",
  "Replique um exemplo real do YouTube/Docs oficiais.",
  "Monte um mini-projeto de 1h e publique (GitHub/Drive).",
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
  if (!process.env.OPENAI_API_KEY) return res.json({ reply: pick3(message), note: "fallback" });

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
    const reply = r?.choices?.[0]?.message?.content?.trim();
    res.json({ reply: reply || pick3(message), model: MODEL });
  } catch (e) {
    res.json({ reply: pick3(message), note: "fallback-error", error: String(e.message) });
  }
});

// ===== Courses =====
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

app.post("/courses/generate", optionalAuth, async (req, res) => {
  const { topic = "Excel para iniciantes", language = "pt" } = req.body || {};
  if (!process.env.OPENAI_API_KEY) {
    const course = buildFallbackCourse(topic, language);
    return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, note: "fallback" });
  }
  try {
    const { client, MODEL } = await getLLM();
    const prompt = `
Gere um curso JSON válido sobre "${topic}" (${language}) exatamente no formato:
{
  "title": "",
  "description": "",
  "level": "",
  "language": "${language}",
  "duration": 6,
  "tags": "",
  "content": { "modules": [ { "title": "", "text": "" } ] }
}
Apenas o JSON, sem comentários nem texto fora do JSON.`;
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });
    const raw = r?.choices?.[0]?.message?.content || "";
    const jsonText = (raw.match(/\{[\s\S]*\}$/) || [raw])[0];
    let json;
    try { json = JSON.parse(jsonText); }
    catch {
      const course = buildFallbackCourse(topic, language);
      return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, note: "fallback-parse" });
    }
    res.json({ ok: true, id: Math.floor(Math.random() * 100000), course: json, model: MODEL });
  } catch (e) {
    const course = buildFallbackCourse(topic, language);
    res.json({ ok: true, id: Math.floor(Math.random() * 100000), course, note: "fallback-error", error: String(e.message) });
  }
});

// ===== Payments & Certificates =====
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

// ===== 404 =====
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));

// ===== START =====
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
