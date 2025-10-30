import axios, { AxiosError } from "axios";
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
  dueTime?: string | null;
}

export async function summarizeEmail(message: Message): Promise<EmailResponse> {
  console.log("========== START SUMMARIZATION ==========");
  console.log("Input:", JSON.stringify(message, null, 2));
  
  const { subject, from, snippet } = message;
  
  try {
    const cleanContent = getCleanEmailContent(snippet);
    console.log("Clean content length:", cleanContent.length);
    console.log("Clean content preview:", cleanContent.substring(0, 200));

    if (shouldSkipAI(subject, cleanContent, from)) {
      console.log("✅ Skipping AI - using fallback");
      return getFallbackResponse(message, cleanContent);
    }

    const prompt = buildPrompt(subject, from, cleanContent);
    console.log("Calling AI...");

    const response = await callGroqWithRetry(prompt, 3);
    console.log("AI response received");
    
    const parsedData = parseAIResponse(response);
    console.log("Parsed AI data:", JSON.stringify(parsedData, null, 2));

    const finalPriority = validatePriority(subject, cleanContent, from, parsedData.priority);
    const { date: dueDate, time: dueTime } = validateDueDate(subject, cleanContent, from, parsedData.dueDate);
    const action = validateAction(cleanContent, parsedData.action);

    const result = {
      subject,
      summary: parsedData.summary || cleanContent.substring(0, 200),
      priority: finalPriority,
      action,
      dueDate,
      dueTime,
    };
    
    console.log("Final result:", JSON.stringify(result, null, 2));
    console.log("========== END SUMMARIZATION ==========\n");
    
    return result;
  } catch (error: any) {
    console.error("❌ ERROR in summarizeEmail:", error);
    console.error("Error stack:", error.stack);
    const fallback = getFallbackResponse(message, getCleanEmailContent(snippet));
    console.log("Returning fallback:", JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function getCleanEmailContent(content: string): string {
  try {
    let cleaned = content.replace(/<style[^>]*>.*?<\/style>/gis, "");
    cleaned = cleaned.replace(/<script[^>]*>.*?<\/script>/gis, "");
    cleaned = cleaned.replace(/<[^>]+>/g, " ");
    cleaned = cleaned
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned.substring(0, 1500);
  } catch (error) {
    console.error("Error in getCleanEmailContent:", error);
    return content.substring(0, 1500);
  }
}

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
  "dueDate": "YYYY-MM-DD HH:mm if there's a specific time, or YYYY-MM-DD if only date, otherwise null"
}

Priority guidelines:
- HIGH: Urgent deadlines (today/tomorrow), critical decisions needed, time-sensitive meetings
- MEDIUM: Standard work tasks, scheduled meetings, requests needing response within a week
- LOW: FYI updates, marketing, automated notifications, OTPs, receipts, newsletters

Due date guidelines:
- Set ONLY for: meetings, appointments, project deadlines, payment due dates
- DO NOT set for: OTP expiry, promotional offer ends, newsletter dates, transaction timestamps`;
}

function shouldSkipAI(subject: string, content: string, from: string): boolean {
  const text = (subject + " " + content + " " + from).toLowerCase();
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

function validatePriority(
  subject: string,
  content: string,
  from: string,
  aiPriority: string
): "high" | "medium" | "low" {
  const text = (subject + " " + content + " " + from).toLowerCase();
  const forceLowPatterns = [
    /\b(otp|verification code|tpin|2fa)\b/i,
    /\bvalid for \d+/i,
    /no-?reply@|noreply@/i,
    /unsubscribe|promotional/i,
    /(transaction|statement) (generated|available)/i,
    /(newsletter|digest)/i,
  ];
  if (forceLowPatterns.some(p => p.test(text))) return "low";

  const forceHighPatterns = [
    /\b(urgent|asap|critical|immediate action)\b/i,
    /\b(deadline today|due today|interview today)\b/i,
    /\bfinal (notice|reminder|warning)\b/i,
  ];
  if (forceHighPatterns.some(p => p.test(text)) && !text.includes("no-reply")) return "high";

  const priority = aiPriority?.toLowerCase();
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority as "high" | "medium" | "low";
  }

  return "medium";
}

function validateDueDate(
  subject: string,
  content: string,
  from: string,
  aiDueDate: string | null
): { date: string | null; time: string | null } {
  try {
    const text = (subject + " " + content + " " + from).toLowerCase();
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
      console.log("Due date blocked by pattern");
      return { date: null, time: null };
    }

    // Try AI-provided date/time first
    if (aiDueDate && aiDueDate !== "null") {
      console.log("Trying AI date:", aiDueDate);
      const parsedDateTime = parseDateTimeString(aiDueDate);
      if (parsedDateTime.date) {
        console.log("AI date parsed successfully:", parsedDateTime);
        return parsedDateTime;
      }
    }

    // Try parsing from subject
    console.log("Trying to parse subject:", subject);
    const subjectDateTime = parseWithChrono(subject);
    if (subjectDateTime.date) {
      console.log("Subject date parsed:", subjectDateTime);
      return subjectDateTime;
    }

    // Try parsing from content if actionable
    if (hasActionableContext(text)) {
      console.log("Trying to parse content (has actionable context)");
      const contentDateTime = parseWithChrono(content);
      if (contentDateTime.date) {
        console.log("Content date parsed:", contentDateTime);
        return contentDateTime;
      }
    }

    console.log("No date found");
    return { date: null, time: null };
  } catch (error) {
    console.error("Error in validateDueDate:", error);
    return { date: null, time: null };
  }
}

function parseDateTimeString(dateStr: string): { date: string | null; time: string | null } {
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      return { date: null, time: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed < today) {
      return { date: null, time: null };
    }

    const date = parsed.toISOString().split("T")[0];
    const hours = parsed.getHours();
    const minutes = parsed.getMinutes();
    const time = (hours !== 0 || minutes !== 0) 
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      : null;

    return { date, time };
  } catch {
    return { date: null, time: null };
  }
}

function parseWithChrono(text: string): { date: string | null; time: string | null } {
  try {
    const parsed = chrono.parse(text, new Date(), { forwardDate: true });
    if (!parsed || parsed.length === 0) {
      return { date: null, time: null };
    }

    const result = parsed[0];
    const dateObj = result.start.date();
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      return { date: null, time: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return { date: null, time: null };
    }

    const date = dateObj.toISOString().split("T")[0];
    const hasTime = result.start.isCertain('hour');
    const time = hasTime 
      ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
      : null;

    return { date, time };
  } catch {
    return { date: null, time: null };
  }
}

function hasActionableContext(text: string): boolean {
  const actionableKeywords = [
    /\b(meeting|appointment|deadline|due date|submission|interview)\b/i,
    /\b(scheduled for|set for|by|before|until)\b/i,
    /\b(rsvp|confirm|register|attend)\b/i,
  ];
  return actionableKeywords.some(k => k.test(text));
}

function validateAction(content: string, aiAction: string | null): string | null {
  try {
    if (!aiAction || aiAction === "null" || aiAction.length < 10) {
      return extractAction(content);
    }
    let action = aiAction.trim();
    action = action.replace(/^(please|kindly|you need to|you should)\s+/i, "");
    return action.length > 5 ? action : null;
  } catch (error) {
    console.error("Error in validateAction:", error);
    return null;
  }
}

function extractAction(text: string): string | null {
  try {
    const actionPatterns = [
      /action required:?\s*([^.!?\n]+)/i,
      /please\s+([^.!?\n]{10,100})/i,
      /you (?:need|must|should)\s+([^.!?\n]{10,100})/i,
      /(?:confirm|review|approve|respond|reply)\s+([^.!?\n]{10,100})/i,
    ];
    for (const pattern of actionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1].trim().substring(0, 100);
    }
    return null;
  } catch (error) {
    console.error("Error in extractAction:", error);
    return null;
  }
}

async function callGroqWithRetry(prompt: string, maxRetries: number = 3) {
  console.log("API Key exists:", !!process.env.GROQ_API_KEY);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`API call attempt ${attempt + 1}/${maxRetries}`);
      
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are an email classifier. Analyze emails objectively and return valid JSON only. Default to MEDIUM priority unless clearly urgent or clearly unimportant.",
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
      
      console.log("API call successful");
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`Attempt ${attempt + 1} failed:`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      if (axiosError.response?.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`⏳ Rate limited. Retrying in ${Math.round(waitTime)}ms`);
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

function parseAIResponse(response: any): any {
  try {
    console.log("Raw AI response:", JSON.stringify(response, null, 2));
    
    let content = response.choices[0].message.content;
    console.log("Content before cleaning:", content);
    
    content = content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    console.log("Content after cleaning:", content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("Successfully parsed JSON:", parsed);
      return parsed;
    }
    
    console.error("No valid JSON found in response");
    throw new Error("No valid JSON in AI response");
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw error;
  }
}

function getFallbackResponse(message: Message, cleanContent: string): EmailResponse {
  const { subject, from } = message;
  const priority = determinePriority(subject, cleanContent, from);
  const action = extractAction(cleanContent);
  const { date: dueDate, time: dueTime } = validateDueDate(subject, cleanContent, from, null);
  
  return {
    subject,
    summary: cleanContent.substring(0, 200) + (cleanContent.length > 200 ? "..." : ""),
    priority,
    action,
    dueDate,
    dueTime,
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
  if (highPatterns.some(p => p.test(text)) && !text.includes("no-reply")) return "high";
  
  return "medium";
}