import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const app = express();

app.use(cors());

app.use(express.json());

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../client")));

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post("/users", async (req, res) => {
  const { name } = req.body;
  const user = await prisma.user.create({ data: { name } });
  res.json(user);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен : http://localhost:${PORT}`);
});