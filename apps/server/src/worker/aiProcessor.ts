import { prisma } from "@repo/db";
import { summarizeEmail } from "../lib/summarizeEmail";
import {
  addEventToGoogleCalendar,
  isMeetingEmail,
} from "../lib/googleCalender";
import { Worker, Job } from "bullmq";
import { connection } from "../queue/connection";

export const emailWorker = new Worker(
  "email-processing",
  async (job: Job) => {
    console.log("entered email worker", job.data);
    const emailId = job.data.emailId;
    const email = await prisma.email.findUnique({
      where: { emailId : emailId },
      include: {
        user: {
          include: { accounts: true },
        },
      },
    });

    console.log("Processing email :", email);

    if (!email) {
      return;
    }

    const result = await summarizeEmail(email);

    const refreshToken = email.user.accounts[0]?.refresh_token;
    if (isMeetingEmail(email.subject, email.snippet) && refreshToken) {
      if (result.dueDate && result.dueTime) {
        await addEventToGoogleCalendar(refreshToken, {
          summary: email.subject,
          dueDate: result.dueDate,
          dueTime: result.dueTime,
        });
      }
    }

    await prisma.email.update({
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

    return `✅ Processed ${email.subject}`;
  },
  { connection }
);

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed!`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} has failed with error: ${err.message}`);
});
