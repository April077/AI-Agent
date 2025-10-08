export async function summarizeEmail(message: { subject: string; snippet: string }) {
  return {
    summary: `Summary of: ${message.subject}`,
    priority: "medium",
    action: "none",
    dueDate: null,
  };
}