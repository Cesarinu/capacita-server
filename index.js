// Servidor minimal compatível com seu front
// - Sem banco de dados (evita 502/erros de build)
// - Rotas que o front usa já presentes
// - CORS liberado
// - Token "fake" para não travar fluxo do front

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.set("x-powered-by", false);
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

// =============== HEALTH & STATUS ===============
app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "1.0.0" });
});

app.get("/status", (_req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,   // opcional
    stripe: !!process.env.STRIPE_SECRET,    // opcional
    mercadopago: !!process.env.MP_ACCESS_TOKEN, // opcional
    web_url: process.env.WEB_URL || null
  });
});

// =============== AUTH (fake, para não quebrar o front) ===============
const DEMO_USER = {
  id: 1,
  email: "demo@cap.ci",
  name: "Demo User"
};
// Token estático só para satisfazer o front
const FAKE_TOKEN = "demo-token";

app.post("/auth/login", (req, res) => {
  // aceita qualquer email/senha para simplificar
  const { email = DEMO_USER.email, password = "123456" } = req.body || {};
  res.json({
    token: FAKE_TOKEN,
    user: { id: DEMO_USER.id, email, name: "Aluno" }
  });
});

app.post("/auth/register", (req, res) => {
  const { email, name = "Aluno", password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }
  res.json({
    token: FAKE_TOKEN,
    user: { id: Math.floor(Math.random() * 10000), email, name }
  });
});

// =============== MIDDLEWARE (opcional) ===============
function optionalAuth(req, _res, next) {
  // Seu front envia Authorization: Bearer <token>
  // Aqui só seguimos em frente, sem validar
  req.user = { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name };
  next();
}

// =============== MENTOR (com respostas variadas, sem OpenAI) ===============
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
function pick3(msg) {
  const s = [...fallbackTips].sort(() => 0.5 - Math.random()).slice(0, 3);
  return `Sobre "${msg}":\n- ${s[0]}\n- ${s[1]}\n- ${s[2]}`;
}

app.post("/mentor/ask", optionalAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Mensagem vazia" });

  // Sem OPENAI_API_KEY, respondemos com variações úteis (não repetitivas)
  return res.json({ reply: pick3(message) });
});

// =============== COURSES (geração por IA com fallback) ===============
function buildFallbackCourse(topic, language = "pt") {
  const modules = [
    {
      title: `Introdução a ${topic}`,
      text: `Objetivos e visão geral de ${topic}. Aplicações práticas.`,
      quiz: [{ q: `${topic} serve para quê?`, options: ["Automação", "Relatórios", "Ambos"], a: 2 }]
    },
    {
      title: "Fundamentos Essenciais",
      text: `Conceitos-chave, boas práticas e erros comuns.`,
      quiz: [{ q: "Melhor prática?", options: ["Pular teoria", "Planejar estudo", "Evitar exercícios"], a: 1 }]
    },
    {
      title: "Prática Guiada",
      text: "Exercícios progressivos com exemplos do mundo real.",
      quiz: [{ q: "Exercícios por dia?", options: ["1", "3", "10"], a: 1 }]
    },
    {
      title: "Projeto Final",
      text: "Construa um mini-projeto de 1h e publique (GitHub/Drive).",
      quiz: [{ q: "Entrega final?", options: ["Resumo", "Projeto", "Prova"], a: 1 }]
    }
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
  // Como aqui é minimal, sempre devolvemos o fallback (sem OpenAI)
  const course = buildFallbackCourse(topic, language);
  // ID fake só para o front não quebrar
  return res.json({ ok: true, id: Math.floor(Math.random() * 100000), course });
});

// =============== PAYMENTS (status para não "quebrar" a UI) ===============
app.get("/payments/status", (_req, res) => {
  res.json({
    stripe: !!process.env.STRIPE_SECRET,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    web_url: process.env.WEB_URL || null
  });
});

// =============== CERTIFICATES (fake mint) ===============
app.post("/certificates/mint", optionalAuth, (_req, res) => {
  const tx = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
  res.json({ ok: true, txHash: tx });
});

// =============== 404 ===============
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// =============== START ===============
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});