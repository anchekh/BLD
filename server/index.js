import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();

app.use(cors());

app.use(express.json());

const prisma = new PrismaClient();

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post("/users", async (req, res) => {
  const { name } = req.body;
  const user = await prisma.user.create({ data: { name } });
  res.json(user);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен : http://localhost:${PORT}`);
});