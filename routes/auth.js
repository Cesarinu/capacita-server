
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';
const router = express.Router();
const sign = u => jwt.sign({ id:u.id, email:u.email, name:u.name }, process.env.JWT_SECRET, { expiresIn:'7d' });

router.post('/register',(req,res)=>{
  const { email, password, name } = req.body;
  if(!email||!password||!name) return res.status(400).json({error:'Dados incompletos'});
  const hash = bcrypt.hashSync(password,10);
  try{
    const info = db.prepare('INSERT INTO users (email,password_hash,name) VALUES (?,?,?)').run(email,hash,name);
    const user = { id:info.lastInsertRowid, email, name };
    res.json({ token:sign(user), user });
  }catch{ res.status(400).json({ error:'Email já cadastrado' }); }
});

router.post('/login',(req,res)=>{
  const { email, password }=req.body;
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u) return res.status(401).json({ error:'Credenciais inválidas' });
  if(!bcrypt.compareSync(password,u.password_hash)) return res.status(401).json({ error:'Credenciais inválidas' });
  res.json({ token:sign(u), user:{ id:u.id, email:u.email, name:u.name } });
});

export default router;
