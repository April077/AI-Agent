import { prisma } from "@repo/db";
import { google } from "googleapis";
import cron from "node-cron";

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

// ✅ Runs every 10 min
cron.schedule("*/1 * * * *", async () => {
  log("🔄 Email Fetcher: Starting cron cycle...");

  try {
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
      },
    });

    log(`👥 Found ${users.length} users with Gmail accounts.`);
    console.log(JSON.stringify(users, null, 2));

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

  const lastEmail = await prisma.email.findFirst({
    where: { userId },
    orderBy: { receivedAt: "desc" },
  });

  const after =
    lastEmail?.receivedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const afterTimeStamp = Math.floor(after.getTime() / 1000);

  log(
    `📅 Fetching messages after ${after.toISOString()} (timestamp: ${afterTimeStamp})`
  );

  const response = await gmail.users.messages.list({
    userId: "me",
    q: `after:${afterTimeStamp}`,
    maxResults: 50,
  });

  const newMails = response.data.messages || [];
  log(`📧 Found ${newMails.length} new messages for user ${userId}.`);

  if (newMails.length === 0) return;

  let storedCount = 0;

  for (const mail of newMails) {
    try {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: mail.id!,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
      const from =
        headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";
      const body = getEmailBody(fullMsg.data.payload);
      const snippet = fullMsg.data.snippet || "";
      const receivedAt = new Date(parseInt(fullMsg.data.internalDate || "0"));

      await prisma.email.upsert({
        where: { emailId: mail.id! },
        update: {},
        create: {
          userId,
          emailId: mail.id!,
          subject,
          from,
          snippet: body || snippet,
          receivedAt,
          processed: false,
          summary: null,
          priority: null,
          action: null,
          dueDate: null,
        },
      });

      storedCount++;
      log(`✅ Stored email: ${subject} from ${from}`);
    } catch (err) {
      log(`⚠️ Error storing email ${mail.id}:`, err);
    }
  }

  log(
    `📦 Total stored: ${storedCount}/${newMails.length} new emails for user ${userId}`
  );
}

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
          body = decodeBase64(part.body.data)
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
