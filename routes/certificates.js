
import express from 'express';
import { requireAuth } from './_auth.js';
const router = express.Router();
router.post('/mint', requireAuth, (req,res)=>{
  const tx = '0x'+Math.random().toString(16).slice(2).padEnd(64,'0');
  res.json({ ok:true, txHash:tx });
});
export default router;
