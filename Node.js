import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.get("/status", (req, res) => {
  res.json({
    server: "online",
    openai: process.env.OPENAI_API_KEY ? true : false
  });
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
