
import express from 'express';
import { db } from '../index.js';
import { requireAuth } from './_auth.js';
const router = express.Router();
router.get('/me', requireAuth, (req,res)=>{
  const total = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
  const my = db.prepare('SELECT COUNT(*) c FROM progress WHERE user_id=?').get(req.user.id).c;
  const avg = db.prepare('SELECT AVG(progress) p FROM progress WHERE user_id=?').get(req.user.id).p || 0;
  res.json({ totalCourses: total, startedCourses: my, avgProgress: Math.round(avg) });
});
export default router;
