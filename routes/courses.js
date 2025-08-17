
import express from 'express';
import { db } from '../index.js';
import { requireAuth } from './_auth.js';
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
  res.json({course:c, progress:p.progress});
});

router.post('/:id/progress', requireAuth, (req,res)=>{
  const {progress}=req.body;
  const up = db.prepare('SELECT id FROM progress WHERE user_id=? AND course_id=?').get(req.user.id, req.params.id);
  if(up) db.prepare('UPDATE progress SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(progress, up.id);
  else db.prepare('INSERT INTO progress(user_id,course_id,progress) VALUES (?,?,?)').run(req.user.id, req.params.id, progress);
  res.json({ok:true});
});

export default router;
