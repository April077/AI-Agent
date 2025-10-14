import axios from "axios";
import * as chrono from "chrono-node";

interface Message {
  id: string;
  subject: string;
  from: string;
  snippet: string;
}

interface EmailResponse {
  subject: string;
  summary: string;
  priority: "high" | "medium" | "low";
  action: string | null;
  dueDate: string | null;
}

export async function summarizeEmail(message: Message): Promise<EmailResponse> {
  const { subject, from, snippet } = message;

  const prompt = `Analyze this email and respond with ONLY a valid JSON object (no markdown, no other text):

Email Subject: ${subject}
From: ${from}
Body: ${snippet}

IMPORTANT: Look carefully for ANY dates, times, or deadlines in BOTH the subject and body. Extract them even if written informally (e.g., "tomorrow", "next Monday", "Jan 15", "3pm today").

CRITICAL PRIORITY RULES (follow these EXACTLY):

1. ALWAYS mark as LOW priority if email contains ANY of these:
   - OTPs, verification codes, authentication codes (even if time-sensitive)
   - Transaction receipts, confirmations, statements, account activity
   - TPIN, passwords, security alerts (non-urgent security notifications)
   - Promotional content (cashback, discount, sale, offer, deal, coupon, limited time, shop now)
   - Marketing (advertisement, promo, exclusive offer, rewards, earn points, save up to)
   - Newsletters, digests, weekly/monthly updates, blog posts
   - Social media notifications (LinkedIn connections, Facebook notifications, etc.)
   - Automated messages (no-reply, do not reply, auto-generated)
   - FYI messages, notifications, alerts without required action
   - Subscription confirmations, welcome emails
   - "Did you know", tips, suggestions

2. Mark as HIGH priority ONLY if ALL of these are true:
   - Requires human action (not automated/transactional)
   - Contains urgent time indicators: "today", "tomorrow", "immediate", "asap", "urgent", "by EOD"
   - Critical work/personal items: "interview", "final notice", "overdue", "time-sensitive", "action required"
   - NOT an OTP, transaction, or automated notification
   
3. Mark as MEDIUM priority for:
   - Real meetings with specific dates/times (not automated invites)
   - Work deadlines, review requests WITHOUT urgent time indicators
   - Important personal correspondence requiring response
   - Important but not time-critical work items

Return JSON with these exact keys:
{
  "summary": "2-3 sentence summary of the email",
  "priority": "high" or "medium" or "low",
  "action": "specific action needed or null",
  "dueDate": "deadline in YYYY-MM-DD format or null"
}`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are an email analyzer. Always respond with valid JSON only, no markdown formatting. Prioritize user productivity by marking transactional and automated emails as low priority." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 300
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000
      }
    );

    let content = response.data.choices[0].message.content;
    content = content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    console.log("AI raw response:", content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsedData = JSON.parse(content);

    console.log("AI parsed data:", parsedData);

    // Override AI priority if it misclassified common patterns
    const overridePriority = forceCorrectPriority(subject, snippet, parsedData.priority);

    const dueDate = parseDueDate(parsedData.dueDate, subject + " " + snippet, subject);

    console.log("Final priority:", overridePriority, "(AI said:", parsedData.priority + ")");
    console.log("Parsed due date:", dueDate);

    return {
      subject,
      summary: parsedData.summary || snippet.substring(0, 200),
      priority: overridePriority,
      action: parsedData.action || null,
      dueDate,
    };
  } catch (error: any) {
    console.error("AI summarization failed, using fallback:", error.message);
    const fallback = simpleParseEmail(snippet, subject);
    const dueDate = parseDueDate(fallback.dueDate, subject + " " + snippet, subject);

    return {
      subject,
      summary: fallback.summary || snippet.substring(0, 200),
      priority: fallback.priority || "medium",
      action: fallback.action || null,
      dueDate,
    };
  }
}

// Force correct priority for common patterns that AI often misclassifies
function forceCorrectPriority(
  subject: string, 
  snippet: string, 
  aiPriority: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  const text = (subject + " " + snippet).toLowerCase();
  
  // ALWAYS low priority patterns (override AI)
  const alwaysLowPatterns = [
    /\b(otp|one.time.password|verification.code|auth.code)\b/i,
    /\b(tpin|transaction.password)\b/i,
    /\b(transaction.statement|account.statement|transaction.report)\b/i,
    /\b(demat.account|portfolio.update|stock.holding)\b/i,
    /\b(expires?.in.\d+.minutes?)\b/i, // "expires in 15 minutes"
    /\b(linkedin.connection|facebook.notification|twitter.mention)\b/i,
    /\b(welcome.to|thank.you.for.signing|subscription.confirmed)\b/i,
    /\bcodepen.weekly\b/i,
  ];

  if (alwaysLowPatterns.some(pattern => pattern.test(text))) {
    return "low";
  }

  // If AI said low, trust it
  if (aiPriority === "low") {
    return "low";
  }

  // Otherwise use AI's judgment
  return aiPriority;
}

function simpleParseEmail(snippet: string, subject: string): Partial<EmailResponse> {
  return {
    summary: snippet.substring(0, 200) + (snippet.length > 200 ? "..." : ""),
    priority: determinePriority(subject, snippet),
    action: extractAction(snippet),
    dueDate: extractDate(subject + " " + snippet),
  };
}

function determinePriority(subject: string, snippet: string): "high" | "medium" | "low" {
  const text = (subject + " " + snippet).toLowerCase();
  
  // Check always-low patterns first
  const alwaysLowKeywords = [
    "otp", "one time password", "verification code", "auth code", "tpin",
    "transaction statement", "account statement", "transaction report",
    "demat account", "portfolio", "expires in", "linkedin", "facebook",
    "codepen", "welcome to", "thank you for signing", "subscription confirmed"
  ];
  if (alwaysLowKeywords.some(k => text.includes(k))) return "low";

  const promotionalKeywords = ["unsubscribe", "promotional", "marketing", "advertisement", "cashback", "% off", "discount", "sale", "offer", "deal", "coupon", "promo", "limited time", "shop now", "buy now", "free shipping", "flash sale", "exclusive offer", "special offer", "redeem", "voucher", "rewards points", "earn", "save up to", "get up to", "click here to claim"];
  if (promotionalKeywords.some(k => text.includes(k))) return "low";
  
  const lowPriorityKeywords = ["newsletter", "digest", "weekly update", "monthly update", "notification", "fyi", "no reply", "noreply", "do not reply", "automated message", "auto-generated"];
  if (lowPriorityKeywords.some(k => text.includes(k))) return "low";
  
  const highPriorityKeywords = ["urgent", "asap", "immediate action", "critical", "deadline today", "deadline tomorrow", "meeting today", "meeting tomorrow", "interview", "action required", "response required", "approval needed", "overdue", "final notice", "time-sensitive", "requires immediate"];
  if (highPriorityKeywords.some(k => text.includes(k))) return "high";
  
  const mediumHighKeywords = ["meeting", "deadline", "due date", "review needed", "approval", "confirm", "rsvp", "registration", "submission required"];
  if (mediumHighKeywords.some(k => text.includes(k))) {
    const hasNearTermDate = /\b(today|tomorrow|this week|within \d+ (day|hour)s?)\b/i.test(text);
    return hasNearTermDate ? "high" : "medium";
  }
  
  return "medium";
}

function extractAction(text: string): string | null {
  const actionKeywords = ["please", "action required", "respond", "reply", "confirm", "review", "approve", "meeting", "attend", "prepare", "submit"];
  const lowerText = text.toLowerCase();
  for (const keyword of actionKeywords) {
    if (lowerText.includes(keyword)) {
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) return sentence.trim().substring(0, 100);
      }
      return `Action: ${keyword}`;
    }
  }
  return null;
}

function extractDate(text: string): string | null {
  const parsed = chrono.parseDate(text);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
}

function parseDueDate(input: string | null | undefined, fullText: string, subject: string): string | null {
  if (input && input.toLowerCase() !== "null") {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  
  const subjectDate = chrono.parseDate(subject);
  if (subjectDate && !isNaN(subjectDate.getTime())) {
    return subjectDate.toISOString().split("T")[0];
  }
  
  return extractDate(fullText);
}