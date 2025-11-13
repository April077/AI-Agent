import { Queue } from "bullmq";
import { connection } from "./connection.js";

export const emailQueue = new Queue("email-processing", { connection });
