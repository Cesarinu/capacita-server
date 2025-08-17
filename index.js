
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './src/db.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import mentorRoutes from './routes/mentor.js';
import payRoutes from './routes/payments.js';
import certRoutes from './routes/certificates.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();
const app = express();
app.use(cors({ origin:true }));
app.use(express.json());

export const db = initDb();

app.get('/health', (req,res)=> res.json({ ok:true }));

app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/mentor', mentorRoutes);
app.use('/payments', payRoutes);
app.use('/certificates', certRoutes);
app.use('/analytics', analyticsRoutes);

app.get('/seed', (req,res)=>{
  try{
    db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, name)
      VALUES ('demo@cap.ci', '$2a$10$Qxnnn7mQf0sF2f9b0l1U5eG9wS0FQw5h8e7kGzVYf3QFQ8KPMpAq2', 'Demo User')`).run();
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`API on http://localhost:${PORT}`));
