import { prisma } from "@repo/db";
import PQueue from "p-queue";
import { summarizeEmail } from "../summarizeEmail";
import { addEventToGoogleCalendar, isMeetingEmail } from "../googleCalender";

const queue = new PQueue({
  concurrency: 1,
  interval: 2100,
  intervalCap: 1,
});

async function startProcessor() {
  while (true) {
    try {
      const unprocessedEmails = await prisma.email.findMany({
        where: { processed: false },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
          user: {
            include: {
              accounts: {
                where: {
                  provider: "google",
                },
              },
            },
          },
        },
      });

      if (unprocessedEmails.length === 0) {
        console.log("✅ AI Processor: No unprocessed emails found. Waiting...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }

      console.log(`Processing ${unprocessedEmails.length} emails...`);

      for (const email of unprocessedEmails) {
        try {
          const result = await queue.add(() => summarizeEmail(email));

          const refreshToken = email.user.accounts[0].refresh_token;

          if (!refreshToken) {
            console.log(
              ` AI Processor: No refresh token for user ${email.user.id}, skipping calendar event creation...`
            );
            return;
          }

          if (isMeetingEmail(email.subject, email.snippet) && result.dueDate) {
            await addEventToGoogleCalendar(refreshToken, {
              summary: email.subject,
              dueDate: result.dueDate,
            });
          }

          await prisma.email.update({
            where: { id: email.id },
            data: {
              processed: true,
              summary: result.summary,
              priority: result.priority,
              action: result.action,
              dueDate: result.dueDate ? new Date(result.dueDate) : null,
            },
          });
          console.log(`  ✅ ${email.subject} → ${result.priority}`);
        } catch (error) {
          console.error(`  ❌ Failed: ${email.subject}`, error);
        }
      }
    } catch (error) {
      console.error("AI Processor: Error fetching unprocessed emails:", error);
      continue;
    }
  }
}

startProcessor();
