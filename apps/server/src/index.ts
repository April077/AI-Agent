import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

app.post("/test-gmail", async (req, res) => {
  const { refreshToken } = req.body;
  console.log("Received refreshToken:", refreshToken);

  if (!refreshToken) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set refresh token
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // // Get access token
    // const accessToken = await oauth2Client.getAccessToken();

    // Gmail client
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Step 1: List unread messages
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 5,
    });

    const messages = [];

    // Step 2: Fetch full message details
    for (const msg of list.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full", // full headers + body
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
      const from =
        headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";
      const snippet = fullMsg.data.snippet || "";

      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject,
        from,
        snippet,
      });
    }

    console.log("Unread messages:", messages);
    // res.json({ accessToken: accessToken.token, messages });
  } catch (err: any) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("Server running on 4000"));
