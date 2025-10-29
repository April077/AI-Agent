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
              accounts: true,
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
          console.log(`  📝 Ai result at ai Processor: }`, result);
          const refreshToken = email.user.accounts[0]?.refresh_token;

          // Only attempt calendar creation if it's actually a meeting
          if (isMeetingEmail(email.subject, email.snippet)) {
            if (!refreshToken) {
              console.log(
                `⚠️ AI Processor: No refresh token for user ${email.user.id}, skipping calendar event creation...`
              );
              // Don't return - continue processing the email
            } else if (result.dueDate && result.dueTime) {
              console.log(
                `📅 Adding high-priority meeting to calendar: ${email.subject}`
              );

              await addEventToGoogleCalendar(refreshToken, {
                summary: email.subject,
                dueDate: result.dueDate,
                dueTime: result.dueTime,
              });
            } else {
              console.log(
                `⏭️ Meeting email but not high-priority or no date: ${email.subject}`
              );
            }
          } else {
            console.log(`⏭️ Not a meeting email: ${email.subject}`);
          }

          // Always update the email record
          const responseUpdate = await prisma.email.update({
            where: { id: email.id },
            data: {
              processed: true,
              summary: result.summary,
              priority: result.priority,
              action: result.action,
              dueDate: result.dueDate ? new Date(result.dueDate) : null,
              dueTime: result.dueTime || null,
            },
          });
          console.log(`  ✅ Processed: ${email.subject}`, responseUpdate);
        } catch (error) {
          console.error(`  ❌ Failed: ${email.subject}`, error);

          // Mark as processed even on failure to avoid infinite retry
          try {
            await prisma.email.update({
              where: { id: email.id },
              data: { processed: true },
            });
          } catch (updateError) {
            console.error(`  ❌ Failed to mark as processed: ${email.id}`);
          }
        }
      }
    } catch (error) {
      console.error("AI Processor: Error fetching unprocessed emails:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retry
      continue;
    }
  }
}

startProcessor();
