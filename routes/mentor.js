
import express from 'express';
import { requireAuth } from './_auth.js';
import OpenAI from 'openai';

const router = express.Router();

router.post('/ask', requireAuth, async (req,res)=>{
  const { message } = req.body || {};
  if(!message) return res.status(400).json({ error:'Mensagem vazia' });
  try{
    if(!process.env.OPENAI_API_KEY) throw new Error('Sem chave');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.6,
      messages:[
        { role:'system', content:'Você é um mentor prático e motivador. Foque em passos acionáveis.'},
        { role:'user', content: message }
      ]
    });
    res.json({ reply: r.choices?.[0]?.message?.content || 'Pratique 30 min e revise exemplos.' });
  }catch{
    res.json({ reply: `Sugestões rápidas:\n- Divida o objetivo em passos curtos\n- Técnica Pomodoro (25/5)\n- Faça 3 exercícios hoje` });
  }
});

export default router;
