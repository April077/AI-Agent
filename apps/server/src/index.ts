import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { summarizeEmail } from "./summarizeEmail";
import { prisma } from "@repo/db";

dotenv.config();

const app = express();

// Enhanced CORS configuration
app.use(cors({ 
  origin: process.env.HOSTURL || "http://localhost:3000", 
  credentials: true 
}));
app.use(express.json());

// Add a simple health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.post("/test-gmail", async (req, res) => {
  console.log("\n🚀 === NEW REQUEST TO /test-gmail ===");
  const { refreshToken, userId } = req.body;
  console.log("📝 Received refreshToken:", refreshToken ? "✅ Present" : "❌ Missing");
  console.log("📝 Received userId:", userId);

  if (!refreshToken) {
    console.log("❌ ERROR: Missing refresh token");
    return res.status(400).json({ error: "Missing refresh token" });
  }

  if (!userId) {
    console.log("❌ ERROR: Missing userId");
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // 1️⃣ Initialize OAuth2 client
    console.log("🔑 Step 1: Initializing OAuth2 client...");
    console.log("   CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ Set" : "❌ Missing");
    console.log("   CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✅ Set" : "❌ Missing");
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    console.log("   ✅ OAuth2 client created");

    // 2️⃣ Set refresh token
    console.log("🔄 Step 2: Setting refresh token credentials...");
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    console.log("   ✅ Credentials set");

    // 3️⃣ Get access token
    console.log("🎫 Step 3: Getting access token...");
    const accessToken = await oauth2Client.getAccessToken();
    console.log("   ✅ Access token obtained:", accessToken.token ? "✅ Present" : "❌ Missing");

    // 4️⃣ Gmail client
    console.log("📧 Step 4: Initializing Gmail client...");
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    console.log("   ✅ Gmail client created");

    // 5️⃣ List unread messages
    console.log("📨 Step 5: Fetching unread messages...");
    console.log("   Query: is:unread, maxResults: 5");
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 5,
    });
    console.log(`   ✅ Found ${list.data.messages?.length || 0} unread messages`);

    const messages = [];

    // 6️⃣ Fetch full details for each message
    console.log("📬 Step 6: Fetching message details...");
    for (const msg of list.data.messages || []) {
      console.log(`   📩 Fetching message ID: ${msg.id}`);
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

      console.log(`      Subject: ${subject.substring(0, 50)}...`);
      console.log(`      From: ${from.substring(0, 50)}...`);

      messages.push({
        id: msg.id!,
        subject,
        from,
        snippet,
      });
    }

    console.log(`   ✅ Fetched details for ${messages.length} messages`);

    console.log(`\n🔄 Step 7: Processing ${messages.length} emails...`);

    // 7️⃣ Process each email
    for (const message of messages) {
      try {
        console.log(`\n   📧 Processing email ID: ${message.id}`);
        console.log(`      Subject: ${message.subject.substring(0, 50)}...`);
        
        console.log("      🔍 Checking if email exists in database...");
        const existing = await prisma.task.findUnique({
          where: { emailId: message.id },
        });

        if (existing) {
          console.log("      ⏭️  Message already exists in DB, skipping");
          continue;
        }
        console.log("      ✅ Email not in database, processing...");

        console.log("      🤖 Calling AI summarization...");
        const aiSummary = await summarizeEmail(message);
        console.log("      ✅ AI Summary received:");
        console.log("         Priority:", aiSummary.priority);
        console.log("         Action:", aiSummary.action);
        console.log("         Summary:", aiSummary.summary?.substring(0, 100) + "...");

        console.log("      💾 Creating task in database...");
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

        console.log("      ✅ Task created successfully!");
      } catch (emailErr: any) {
        console.error("      ❌ ERROR processing email:", message.id);
        console.error("         Error message:", emailErr.message);
        console.error("         Error stack:", emailErr.stack);
        // Continue processing other emails even if one fails
      }
    }

    console.log("\n✅ Successfully processed all messages");
    console.log("📊 Summary:");
    console.log(`   Total messages: ${messages.length}`);
    console.log("=== END REQUEST ===\n");
    
    return res.json({ 
      success: true,
      accessToken: accessToken.token, 
      messages,
      processedCount: messages.length
    });
  } catch (err: any) {
    console.error("\n❌ === FATAL ERROR ===");
    console.error("Error type:", err.constructor.name);
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Error status:", err.status);
    
    if (err.response) {
      console.error("API Response Error:");
      console.error("   Status:", err.response.status);
      console.error("   Status Text:", err.response.statusText);
      console.error("   Data:", JSON.stringify(err.response.data, null, 2));
    }
    
    console.error("Full error stack:", err.stack);
    console.error("=== END ERROR ===\n");
    
    return res.status(500).json({ 
      error: err.message,
      details: err.response?.data,
      code: err.code 
    });
  }
});

// Catch-all for undefined routes
app.use((req, res) => {
  console.log("404 - Route not found:", req.method, req.path);
  res.status(404).json({ 
    error: "Not Found", 
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: [
      "GET /health",
      "POST /test-gmail"
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));