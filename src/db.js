
import Database from 'better-sqlite3';
import path from 'path';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export function initDb(){
  const db = new Database(path.join(__dirname,'..','data.sqlite'));
  db.pragma('journal_mode = WAL');

  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS courses(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT,
    language TEXT,
    duration INTEGER,
    tags TEXT,
    content TEXT
  );
  CREATE TABLE IF NOT EXISTS progress(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    course_id INTEGER,
    progress INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  const count = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
  if (!count){
    db.prepare('INSERT INTO courses (title,description,level,language,duration,tags,content) VALUES (?,?,?,?,?,?,?)')
      .run('Introdução a Excel','Fundamentos para relatórios e análise.','iniciante','pt',6,'office,excel,análise', JSON.stringify({modules:[{title:'Visão geral',text:'O que é Excel',quiz:[]}]}));
  }
  return db;
}
