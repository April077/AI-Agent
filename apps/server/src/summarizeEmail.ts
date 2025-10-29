import axios, { AxiosError } from "axios";
import * as chrono from "chrono-node";

interface Message {
  id: string;
  subject: string;
  from: string;
  snippet: string; // Contains full body now
}

interface EmailResponse {
  subject: string;
  summary: string;
  priority: "high" | "medium" | "low";
  action: string | null;
  dueDate: string | null;
}

// ============ IMPROVED AI SUMMARIZATION ============
export async function summarizeEmail(message: Message): Promise<EmailResponse> {
  const { subject, from, snippet } = message;

  // Clean HTML/formatting from snippet (which contains full body)
  const cleanContent = getCleanEmailContent(snippet);

  // Pre-filter: Skip AI for obvious low-priority patterns
  if (shouldSkipAI(subject, cleanContent, from)) {
    console.log(`Skipping AI for obvious low-priority email: ${subject}`);
    return getFallbackResponse(message, cleanContent);
  }

  const prompt = buildPrompt(subject, from, cleanContent);

  try {
    const response = await callGroqWithRetry(prompt, 3);
    const parsedData = parseAIResponse(response);

    console.log("AI parsed data:", parsedData);

    // Validate and clean AI response
    const finalPriority = validatePriority(subject, cleanContent, from, parsedData.priority);
    const dueDate = validateDueDate(subject, cleanContent, from, parsedData.dueDate);
    const action = validateAction(cleanContent, parsedData.action);

    return {
      subject,
      summary: parsedData.summary || cleanContent.substring(0, 200),
      priority: finalPriority,
      action,
      dueDate,
    };
  } catch (error: any) {
    console.error("AI summarization failed, using fallback:", error.message);
    return getFallbackResponse(message, cleanContent);
  }
}

// ============ HTML CLEANING ============
function getCleanEmailContent(content: string): string {
  // Remove HTML tags
  let cleaned = content.replace(/<style[^>]*>.*?<\/style>/gis, "");
  cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gis, "");
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, "");
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Limit length for API (keep first 1500 chars for context)
  return cleaned.substring(0, 1500);
}

// ============ SIMPLIFIED PROMPT ============
function buildPrompt(subject: string, from: string, content: string): string {
  return `Analyze this email and extract key information.

Subject: ${subject}
From: ${from}
Content: ${content}

Respond with JSON only:
{
  "summary": "2-3 sentence summary of the email's purpose and key points",
  "priority": "high|medium|low",
  "action": "specific action needed from recipient, or null",
  "dueDate": "YYYY-MM-DD if there's a deadline/meeting/event date, otherwise null"
}

Priority guidelines:
- HIGH: Urgent deadlines (today/tomorrow), critical decisions needed, time-sensitive meetings
- MEDIUM: Standard work tasks, scheduled meetings, requests needing response within a week
- LOW: FYI updates, marketing, automated notifications, OTPs, receipts, newsletters

Due date guidelines:
- Set ONLY for: meetings, appointments, project deadlines, payment due dates
- DO NOT set for: OTP expiry, promotional offer ends, newsletter dates, transaction timestamps`;
}

// ============ PRE-FILTERING (OPTIMIZED) ============
function shouldSkipAI(subject: string, content: string, from: string): boolean {
  const text = (subject + " " + content + " " + from).toLowerCase();

  // Clear low-priority patterns
  const skipPatterns = [
    /\b(otp|verification code|2fa|tpin|auth code)\b/i,
    /\bvalid for \d+ (min|hour)/i,
    /no-?reply@|noreply@/i,
    /unsubscribe|promotional/i,
    /(newsletter|digest|weekly update)/i,
    /(linkedin|facebook|instagram) (notification|connection)/i,
    /transaction (statement|receipt|confirmation)/i,
  ];

  return skipPatterns.some((pattern) => pattern.test(text));
}

// ============ PRIORITY VALIDATION ============
function validatePriority(
  subject: string,
  content: string,
  from: string,
  aiPriority: string
): "high" | "medium" | "low" {
  const text = (subject + " " + content + " " + from).toLowerCase();

  // Force LOW for definite patterns
  const forceLowPatterns = [
    /\b(otp|verification code|tpin|2fa)\b/i,
    /\bvalid for \d+/i,
    /no-?reply@|noreply@/i,
    /unsubscribe|promotional/i,
    /(transaction|statement) (generated|available)/i,
    /(newsletter|digest)/i,
  ];

  if (forceLowPatterns.some(p => p.test(text))) {
    return "low";
  }

  // Force HIGH for genuinely urgent patterns
  const forceHighPatterns = [
    /\b(urgent|asap|critical|immediate action)\b/i,
    /\b(deadline today|due today|interview today)\b/i,
    /\bfinal (notice|reminder|warning)\b/i,
  ];

  if (forceHighPatterns.some(p => p.test(text)) && !text.includes("no-reply")) {
    return "high";
  }

  // Trust AI for normal cases
  const priority = aiPriority?.toLowerCase();
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority as "high" | "medium" | "low";
  }

  return "medium"; // Safe default
}

// ============ DUE DATE VALIDATION ============
function validateDueDate(
  subject: string,
  content: string,
  from: string,
  aiDueDate: string | null
): string | null {
  const text = (subject + " " + content + " " + from).toLowerCase();

  // Block due dates for these patterns
  const blockPatterns = [
    /\b(otp|verification code|tpin)\b/i,
    /\bvalid for \d+/i,
    /\bexpires in \d+/i,
    /no-?reply@|noreply@/i,
    /(transaction|statement) (generated|sent|available)/i,
    /promotional|marketing|newsletter/i,
    /(sale|offer|deal) (ends|expires)/i,
  ];

  if (blockPatterns.some(p => p.test(text))) {
    console.log("⛔ Due date blocked: matches exclusion pattern");
    return null;
  }

  // Try AI-provided date first
  if (aiDueDate && aiDueDate !== "null") {
    const parsed = new Date(aiDueDate);
    if (!isNaN(parsed.getTime())) {
      // Only accept future dates or today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed >= today) {
        return parsed.toISOString().split("T")[0];
      }
    }
  }

  // Try parsing from subject (most reliable for meetings)
  const subjectDate = chrono.parseDate(subject);
  if (subjectDate && !isNaN(subjectDate.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (subjectDate >= today) {
      return subjectDate.toISOString().split("T")[0];
    }
  }

  // Try parsing from content (less reliable, only if clear context)
  if (hasActionableContext(text)) {
    const contentDate = chrono.parseDate(content);
    if (contentDate && !isNaN(contentDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (contentDate >= today) {
        return contentDate.toISOString().split("T")[0];
      }
    }
  }

  return null;
}

// Check if content suggests an actionable event
function hasActionableContext(text: string): boolean {
  const actionableKeywords = [
    /\b(meeting|appointment|deadline|due date|submission|interview)\b/i,
    /\b(scheduled for|set for|by|before|until)\b/i,
    /\b(rsvp|confirm|register|attend)\b/i,
  ];
  return actionableKeywords.some(k => k.test(text));
}

// ============ ACTION VALIDATION ============
function validateAction(content: string, aiAction: string | null): string | null {
  if (!aiAction || aiAction === "null" || aiAction.length < 10) {
    // Extract action from content if AI didn't find one
    return extractAction(content);
  }
  
  // Clean up AI action (remove fluff)
  let action = aiAction.trim();
  action = action.replace(/^(please|kindly|you need to|you should)\s+/i, "");
  
  return action.length > 5 ? action : null;
}

function extractAction(text: string): string | null {
  const actionPatterns = [
    /action required:?\s*([^.!?\n]+)/i,
    /please\s+([^.!?\n]{10,100})/i,
    /you (?:need|must|should)\s+([^.!?\n]{10,100})/i,
    /(?:confirm|review|approve|respond|reply)\s+([^.!?\n]{10,100})/i,
  ];

  for (const pattern of actionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  return null;
}

// ============ API CALL WITH RETRY ============
async function callGroqWithRetry(prompt: string, maxRetries: number = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are an email classifier. Analyze emails objectively and return valid JSON only. Default to MEDIUM priority unless clearly urgent or clearly unimportant."
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 300,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`⏳ Rate limited. Retrying in ${Math.round(waitTime)}ms`);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

// ============ RESPONSE PARSING ============
function parseAIResponse(response: any): any {
  let content = response.choices[0].message.content;
  content = content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("No valid JSON in AI response");
}

// ============ FALLBACK RESPONSE ============
function getFallbackResponse(message: Message, cleanContent: string): EmailResponse {
  const { subject, from } = message;
  const priority = determinePriority(subject, cleanContent, from);
  const action = extractAction(cleanContent);
  const dueDate = validateDueDate(subject, cleanContent, from, null);

  return {
    subject,
    summary: cleanContent.substring(0, 200) + (cleanContent.length > 200 ? "..." : ""),
    priority,
    action,
    dueDate,
  };
}

function determinePriority(
  subject: string,
  content: string,
  from: string
): "high" | "medium" | "low" {
  const text = (subject + " " + content + " " + from).toLowerCase();

  const lowPatterns = [
    /\b(otp|verification code|tpin|2fa)\b/i,
    /no-?reply@/i,
    /unsubscribe|promotional|newsletter/i,
    /transaction (statement|receipt)/i,
  ];
  if (lowPatterns.some(p => p.test(text))) return "low";

  const highPatterns = [
    /\b(urgent|asap|critical)\b/i,
    /\bdeadline (today|tomorrow)\b/i,
    /\bfinal (notice|warning)\b/i,
  ];
  if (highPatterns.some(p => p.test(text)) && !text.includes("no-reply")) {
    return "high";
  }

  return "medium";
}