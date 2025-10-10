import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { summarizeEmail } from "./summarizeEmail";
import { prisma } from "@repo/db";

dotenv.config();

const app = express();

app.use(cors({ 
  origin: process.env.HOSTURL || "http://localhost:3000", 
  credentials: true 
}));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.get("/tasks/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const stats = {
      total: tasks.length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
      withActions: tasks.filter(t => t.action).length,
      withDueDates: tasks.filter(t => t.dueDate).length,
    };

    return res.json({ tasks, stats });
  } catch (err: any) {
    console.error("Error fetching tasks:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/test-gmail", async (req, res) => {
  const { refreshToken, userId } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await oauth2Client.getAccessToken();

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 5,
    });

    const messages = [];

    for (const msg of list.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
      const from =
        headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";
      const snippet = fullMsg.data.snippet || "";

      messages.push({
        id: msg.id!,
        subject,
        from,
        snippet,
      });
    }

    for (const message of messages) {
      try {
        const existing = await prisma.task.findUnique({
          where: { emailId: message.id },
        });

        if (existing) {
          continue;
        }

        const aiSummary = await summarizeEmail(message);

        await prisma.task.create({
          data: {
            userId,
            emailId: message.id,
            subject: message.subject,
            summary: aiSummary.summary,
            priority: aiSummary.priority,
            action: aiSummary.action ?? "",
            dueDate: aiSummary.dueDate,
          },
        });
      } catch (emailErr: any) {
        console.error(`Failed to process email ${message.id}:`, emailErr.message);
      }
    }
    
    return res.json({ 
      success: true,
      accessToken: accessToken.token, 
      messages,
      processedCount: messages.length
    });
  } catch (err: any) {
    console.error("Error processing Gmail request:", err.message);
    
    return res.status(500).json({ 
      error: err.message,
      details: err.response?.data,
      code: err.code 
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ 
    error: "Not Found", 
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: [
      "GET /health",
      "POST /test-gmail"
    ]
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));