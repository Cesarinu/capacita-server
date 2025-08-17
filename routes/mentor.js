
import express from 'express';
import { requireAuth } from './_auth.js';
const router = express.Router();

router.post('/ask', requireAuth, async (req,res)=>{
  const { message } = req.body || {};
  if(!message) return res.status(400).json({error:'Mensagem vazia'});
  const tips=['Estude 25min + 5min','Faça 3 exercícios','Revise um resumo curto'];
  res.json({reply:`Sobre "${message}":\n- `+tips.join('\n- ')});
});

export default router;
