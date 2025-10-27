import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { summarizeEmail } from "./summarizeEmail";
import { prisma } from "@repo/db";
import { addEventToGoogleCalendar, isMeetingEmail } from "./googleCalender";
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
  const { priority } = req.query;

  try {
    const whereClause: any = { userId };

    if (priority && ["high", "medium", "low"].includes(priority as string)) {
      whereClause.priority = priority;
    }

    const emails = await prisma.email.findMany({
      where: whereClause,
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

    return res.json({ emails, stats });
  } catch (err: any) {
    console.error("Error fetching emails:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Helper function to extract full email body
function getEmailBody(payload: any): string {
  let body = "";

  function decodeBase64(data: string): string {
    try {
      return Buffer.from(data, "base64").toString("utf-8");
    } catch (e) {
      return "";
    }
  }

  if (payload.body?.data) {
    body = decodeBase64(payload.body.data);
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body = decodeBase64(part.body.data);
        break;
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === "text/plain" && subPart.body?.data) {
            body = decodeBase64(subPart.body.data);
            break;
          }
        }
      }
    }

    if (!body) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          body = decodeBase64(part.body.data);
          body = body
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          break;
        }
      }
    }
  }

  return body.substring(0, 2000);
}

app.post("/sync-emails", async (req, res) => {
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
      maxResults: 10,
    });

    const messages = [];
    const processedEmails = [];
    const skippedEmails = [];

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

      // Extract full body
      const body = getEmailBody(fullMsg.data.payload);
      const snippet = fullMsg.data.snippet || "";
      const labelIds = fullMsg.data.labelIds || [];

      messages.push({
        id: msg.id!,
        subject,
        from,
        snippet: body || snippet, // Use full body, fallback to snippet
        labelIds,
      });
    }

    for (const message of messages) {
      try {
        const existing = await prisma.email.findUnique({
          where: { emailId: message.id },
        });

        if (existing) {
          skippedEmails.push(message.id);
          continue;
        }

        // Pass message with full body as snippet
        const aiSummary = await summarizeEmail(message);

        if (
          isMeetingEmail(message.subject, message.snippet) &&
          aiSummary.dueDate
        ) {
          await addEventToGoogleCalendar(refreshToken, {
            summary: message.subject,
            dueDate: aiSummary.dueDate,
          });
        }

        processedEmails.push({
          id: message.id,
          subject: message.subject,
          priority: aiSummary.priority,
          dueDate: aiSummary.dueDate, // Log for debugging
        });
      } catch (emailErr: any) {
        console.error(
          `Failed to process email ${message.id}:`,
          emailErr.message
        );
      }
    }

    return res.json({
      success: true,
      accessToken: accessToken.token,
      totalFetched: messages.length,
      processed: processedEmails.length,
      skipped: skippedEmails.length,
      processedEmails,
    });
  } catch (err: any) {
    console.error("Error syncing Gmail:", err.message);

    return res.status(500).json({
      error: err.message,
      details: err.response?.data,
      code: err.code,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: [
      "GET /health",
      "GET /emails/:userId",
      "POST /sync-emails",
      "DELETE /emails/:emailId",
      "PATCH /emails/:emailId",
    ],
  });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Server error:", err.message);
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  }
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
