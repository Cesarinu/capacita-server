
import express from 'express';
import { db } from '../index.js';
import { requireAuth } from './_auth.js';
import OpenAI from 'openai';

const router = express.Router();

router.get('/', requireAuth, (req,res)=>{
  const q = (req.query.q||'').toLowerCase();
  const list = db.prepare('SELECT id,title,description,level,language,duration,tags FROM courses').all()
    .filter(c => (c.title+' '+c.description+' '+(c.tags||'')).toLowerCase().includes(q));
  res.json(list);
});

router.get('/:id', requireAuth, (req,res)=>{
  const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
  if(!c) return res.status(404).json({error:'Curso não encontrado'});
  const p = db.prepare('SELECT progress FROM progress WHERE user_id=? AND course_id=?').get(req.user.id,c.id) || {progress:0};
  res.json({ course:c, progress:p.progress });
});

router.post('/:id/progress', requireAuth, (req,res)=>{
  const { progress } = req.body;
  const up = db.prepare('SELECT id FROM progress WHERE user_id=? AND course_id=?').get(req.user.id, req.params.id);
  if (up) db.prepare('UPDATE progress SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(progress, up.id);
  else db.prepare('INSERT INTO progress (user_id,course_id,progress) VALUES (?,?,?)').run(req.user.id, req.params.id, progress);
  res.json({ ok:true });
});

router.post('/generate', requireAuth, async (req,res)=>{
  const { topic='Excel para iniciantes', language='pt' } = req.body || {};
  try{
    if(!process.env.OPENAI_API_KEY) throw new Error('Sem chave OpenAI, usando fallback');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Crie um curso JSON sobre "${topic}" em ${language} no formato:
{"title":"","description":"","level":"","duration":4,"tags":"","content":{"modules":[{"title":"","text":"","quiz":[{"q":"","options":["",""],"a":0}]}]}}`;
    const r = await openai.chat.completions.create({ model:'gpt-4o-mini', temperature:0.7, messages:[{role:'user',content:prompt}] });
    const txt = r.choices?.[0]?.message?.content || '';
    const json = JSON.parse(txt.match(/\{[\s\S]*\}$/)?.[0] || txt);
    const info = db.prepare('INSERT INTO courses (title,description,level,language,duration,tags,content) VALUES (?,?,?,?,?,?,?)')
      .run(json.title, json.description, json.level, language, json.duration, json.tags, JSON.stringify(json.content));
    res.json({ ok:true, id: info.lastInsertRowid });
  }catch(e){
    const content = { modules:[{ title:`Introdução a ${topic}`, text:`Fundamentos de ${topic}.`, quiz:[] }] };
    const info = db.prepare('INSERT INTO courses (title,description,level,language,duration,tags,content) VALUES (?,?,?,?,?,?,?)')
      .run(`${topic} (Auto)`, `Curso gerado automaticamente.`, 'iniciante', language, 4, topic.toLowerCase(), JSON.stringify(content));
    res.json({ ok:true, id: info.lastInsertRowid, note:'fallback' });
  }
});

export default router;
