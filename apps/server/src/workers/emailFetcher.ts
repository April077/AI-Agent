import { prisma } from "@repo/db";
import { google } from "googleapis";
import cron from "node-cron";

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

cron.schedule("*/30 * * * * *", async () => {
  log("🔄 Email Fetcher: Starting cron cycle...");

  try {
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
      },
    });

    for (const user of users) {
      const account = user.accounts[0];
      if (!account?.refresh_token) {
        log(`⚠️ Skipping user ${user.id}: No refresh token found.`);
        continue;
      }

      try {
        log(`📩 Fetching emails for user: ${user.email || user.id}`);
        await fetchAndStoreEmails(user.id, account.refresh_token);
        log(`✅ Completed sync for user: ${user.email || user.id}`);
      } catch (error) {
        log(`❌ Error syncing ${user.email || user.id}:`, error);
      }
    }
  } catch (err) {
    log("🚨 Fatal error in cron job:", err);
  }

  log("🕒 Cron cycle finished.\n");
});

async function fetchAndStoreEmails(userId: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get most recent email timestamp
  const lastEmail = await prisma.email.findFirst({
    where: { userId },
    orderBy: { receivedAt: "desc" },
  });

  // Query from 1 second after last email, or last 24 hours if none
  const afterTimestamp = lastEmail
    ? Math.floor(lastEmail.receivedAt.getTime() / 1000) + 1
    : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

  log(`📅 Querying Gmail for emails after timestamp: ${afterTimestamp}`);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: `after:${afterTimestamp}`,
    maxResults: 50,
  });

  const messages = response.data.messages || [];
  log(`📧 Found ${messages.length} messages`);

  if (messages.length === 0) return;

  let stored = 0;

  for (const msg of messages) {
    try {
      // Check if already exists
      const exists = await prisma.email.findUnique({
        where: { emailId: msg.id! },
      });

      if (exists) continue;

      // Get full message
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = full.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
      const from = headers.find((h) => h.name === "From")?.value || "(Unknown)";
      const body = getEmailBody(full.data.payload);
      const receivedAt = new Date(parseInt(full.data.internalDate || "0"));

      // Store email
      await prisma.email.create({
        data: {
          userId,
          emailId: msg.id!,
          subject,
          from,
          snippet: body || full.data.snippet || "",
          receivedAt,
          processed: false,
          summary: null,
          priority: null,
          action: null,
          dueDate: null,
        },
      });

      stored++;
      log(`✅ Stored: "${subject}"`);
    } catch (err) {
      log(`⚠️ Error with email ${msg.id}:`, err);
    }
  }

  log(`📦 Stored ${stored} new emails`);
}

function getEmailBody(payload: any): string {
  let body = "";

  function decode(data: string): string {
    try {
      return Buffer.from(data, "base64").toString("utf-8");
    } catch {
      return "";
    }
  }

  if (payload.body?.data) {
    body = decode(payload.body.data);
  } else if (payload.parts) {
    // Try text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body = decode(part.body.data);
        break;
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === "text/plain" && subPart.body?.data) {
            body = decode(subPart.body.data);
            break;
          }
        }
      }
      if (body) break;
    }

    // Fallback to HTML
    if (!body) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          body = decode(part.body.data)
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