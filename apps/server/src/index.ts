import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { prisma } from "@repo/db";
// import { summarizeEmail } from "./summarizeEmail.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.HOSTURL, credentials: true }));
app.use(express.json());

app.post("/test-gmail", async (req, res) => {
  const { refreshToken, userId } = req.body;
  console.log("Received refreshToken:", refreshToken);
  console.log("Received usrId:", userId);

  if (!refreshToken) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    // 1️⃣ Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // 2️⃣ Set refresh token
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // 3️⃣ Get access token (optional)
    const accessToken = await oauth2Client.getAccessToken();

    // 4️⃣ Gmail client
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 5️⃣ List unread messages
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 5,
    });

    const messages = [];

    // 6️⃣ Fetch full details for each message
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

    // 7️⃣ Process each email
    for (const message of messages) {
      const existing = await prisma.task.findUnique({
        where: { emailId: message.id },
      });

      if (existing) {
        console.log("Message already exists in DB:", message.id);
        continue;
      }

      // const aiSummary = await summarizeEmail(message);

      // await prisma.task.create({
      //   data: {
      //     userId,
      //     emailId: message.id,
      //     subject: message.subject,
      //     summary: aiSummary.summary,
      //     priority: aiSummary.priority,
      //     action: aiSummary.action,
      //     dueDate: aiSummary.dueDate,
      //   },
      // });
    }

    console.log("Unread messages:", messages);
    return res.json({ accessToken: accessToken.token, messages });
  } catch (err: any) {
    console.error(err.response?.data || err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("✅ Server running on port 4000"));
