import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { prisma } from "@repo/db";
import "./workers/emailFetcher";
import "./workers/aiProcessor";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.HOSTURL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.get("/emails/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const emails = await prisma.email.findMany({
      where: { userId: userId, processed: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const stats = {
      total: emails.length,
      high: emails.filter((e) => e.priority === "high").length,
      medium: emails.filter((e) => e.priority === "medium").length,
      low: emails.filter((e) => e.priority === "low").length,
      withActions: emails.filter((e) => e.action).length,
      withDueDates: emails.filter((e) => e.dueDate).length,
    };
    console.log("Fetched stats  from server:", stats);
    return res.json({ emails, stats });
  } catch (err: any) {
    console.error("Error fetching emails:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
