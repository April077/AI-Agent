import axios, { AxiosError } from "axios";
import * as chrono from "chrono-node";
import pQueue from "p-queue"; 

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

// ============ RATE LIMITING & QUEUE ============
// Groq free tier: 30 requests/minute for llama-3.1-8b-instant
const queue = new pQueue({
  concurrency: 1, // Process one at a time
  interval: 2100, // 2.1 seconds between requests (28 requests/min to be safe)
  intervalCap: 1,
});

// Cache to avoid re-processing same emails
const emailCache = new Map<string, EmailResponse>();

// Batch processing with progress tracking
export async function processBatchEmails(
  messages: Message[],
  onProgress?: (current: number, total: number) => void
): Promise<EmailResponse[]> {
  const results: EmailResponse[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Check cache first
    const cacheKey = `${message.id}-${message.subject}`;
    if (emailCache.has(cacheKey)) {
      results.push(emailCache.get(cacheKey)!);
      onProgress?.(i + 1, messages.length);
      continue;
    }
    
    // Queue the AI request
    const result = await queue.add(() => summarizeEmail(message));
    results.push(result);
    emailCache.set(cacheKey, result);
    
    onProgress?.(i + 1, messages.length);
  }
  
  return results;
}

// ============ IMPROVED AI SUMMARIZATION ============
export async function summarizeEmail(message: Message): Promise<EmailResponse> {
  const { subject, from, snippet } = message;

  // Pre-filter: Skip AI for obvious low-priority patterns
  if (shouldSkipAI(subject, snippet, from)) {
    console.log(`Skipping AI for obvious low-priority email: ${subject}`);
    return getFallbackResponse(message);
  }

  const prompt = buildPrompt(subject, from, snippet);

  try {
    const response = await callGroqWithRetry(prompt, 3);
    const parsedData = parseAIResponse(response);
    
    console.log("AI parsed data:", parsedData);

    // Post-process: Force correct priority for patterns AI often misses
    const finalPriority = enforceCorrectPriority(subject, snippet, from, parsedData.priority);
    const dueDate = parseDueDate(parsedData.dueDate, subject + " " + snippet, subject);

    console.log("Final priority:", finalPriority, "(AI said:", parsedData.priority + ")");
    console.log("Parsed due date:", dueDate);

    return {
      subject,
      summary: parsedData.summary || snippet.substring(0, 200),
      priority: finalPriority,
      action: parsedData.action || null,
      dueDate,
    };
  } catch (error: any) {
    console.error("AI summarization failed, using fallback:", error.message);
    return getFallbackResponse(message);
  }
}

// ============ OPTIMIZED PROMPT ============
function buildPrompt(subject: string, from: string, snippet: string): string {
  return `You are an executive assistant analyzing emails. Classify this email with EXTREME bias toward LOW priority.

Email:
Subject: ${subject}
From: ${from}
Body: ${snippet}

CLASSIFICATION RULES (follow STRICTLY):

🚫 ALWAYS mark as LOW priority (even if seems urgent):
- ANY email with: OTP, verification code, 2FA, authentication, security code, TPIN, PIN
- Transactional: receipts, statements, confirmations, notifications, alerts
- Marketing: sale, offer, discount, promo, cashback, deal, limited time, shop now
- Automated: newsletters, digests, updates, no-reply, noreply, automated
- Social: LinkedIn, Facebook, Twitter, Instagram notifications
- System: welcome emails, subscription confirmations, password resets

✅ Mark as HIGH priority ONLY if ALL conditions met:
1. From a real person (not automated/no-reply)
2. Requires YOUR action (not just FYI)
3. Has urgent deadline: "today", "tomorrow", "by EOD", "urgent", "ASAP"
4. Work-critical: interview, client meeting, approval needed, overdue task
5. NOT transactional, NOT automated, NOT OTP/code

⚠️ Mark as MEDIUM priority for:
- Real meetings with specific date/time (from real people)
- Work tasks with deadlines beyond tomorrow
- Personal emails needing response (but not urgent)

Return ONLY this JSON (no markdown, no explanation):
{
  "summary": "concise 1-2 sentence summary",
  "priority": "low",
  "action": null,
  "dueDate": null
}`;
}

// ============ PRE-FILTERING ============
function shouldSkipAI(subject: string, snippet: string, from: string): boolean {
  const text = (subject + " " + snippet + " " + from).toLowerCase();
  
  // Definitive low-priority patterns - don't waste AI calls
  const skipPatterns = [
    // Authentication & Security
    /\b(otp|one.time.password|verification.code|2fa|two.factor|auth(?:entication)?.code)\b/i,
    /\b(tpin|transaction.password|security.code|access.code)\b/i,
    /\bvalid.for.\d+.min/i,
    /\bexpires?.in.\d+/i,
    
    // Transactional
    /\b(transaction|statement|receipt|confirmation|invoice).+(sent|available|generated)\b/i,
    /\b(your.order|shipment|delivery|payment).+(confirmed|received|processed)\b/i,
    
    // Automated senders
    /no-?reply@/i,
    /noreply@/i,
    /do-?not-?reply@/i,
    /automated@/i,
    /notifications?@/i,
    
    // Marketing
    /\b(unsubscribe|promotional|%\s*off|discount|sale|limited.time|shop.now)\b/i,
    /\b(cashback|offer|deal|coupon|promo|free.shipping)\b/i,
    
    // Newsletters & Digests
    /\b(newsletter|digest|weekly.update|monthly.update|roundup)\b/i,
    /\bcodepen.weekly\b/i,
    
    // Social notifications
    /\b(linkedin|facebook|twitter|instagram).+(connection|notification|mention)\b/i,
  ];

  return skipPatterns.some(pattern => pattern.test(text));
}

// ============ API CALL WITH RETRY ============
async function callGroqWithRetry(prompt: string, maxRetries: number = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            { 
              role: "system", 
              content: "You are an email classifier. Default to LOW priority unless clearly urgent and actionable. Always return valid JSON only." 
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.1, // Very low for consistent classification
          max_tokens: 250,
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      return response.data;
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Jittered backoff
        console.log(`⏳ Rate limited. Retrying in ${Math.round(waitTime)}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
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
  
  console.log("AI raw response:", content);
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error("No valid JSON in AI response");
}

// ============ PRIORITY ENFORCEMENT ============
function enforceCorrectPriority(
  subject: string,
  snippet: string,
  from: string,
  aiPriority: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  const text = (subject + " " + snippet + " " + from).toLowerCase();
  
  // FORCE LOW - these should NEVER be high/medium
  const forceLowPatterns = [
    // OTPs & Auth codes (highest priority override)
    /\b(otp|one.time.password|verification.code|2fa|auth.code|security.code)\b/i,
    /\btpin\b/i,
    /\bvalid.for.\d+.min/i,
    /\bexpires?.in.\d+/i,
    /\b\d{4,8}\b.*\b(code|otp|verification)/i, // "1234 is your code"
    
    // Transactional
    /\b(transaction|statement|receipt).+(generated|available|sent)\b/i,
    /\b(demat|portfolio|holding).+(statement|report|update)\b/i,
    /\baccount.activity/i,
    
    // Marketing & Promotions
    /\b(unsubscribe|promotional|%\s*off|discount|cashback)\b/i,
    /\b(offer|deal|sale|coupon|limited.time)\b/i,
    
    // Automated systems
    /no-?reply@/i,
    /noreply@/i,
    /@noreply\./i,
    /do-?not-?reply/i,
    
    // Newsletters
    /\b(newsletter|digest|weekly.update|codepen.weekly)\b/i,
    
    // Social notifications
    /\b(linkedin|facebook).+(connection|notification)/i,
    
    // Welcome/Onboarding
    /\b(welcome.to|thank.you.for.(signing|subscribing|joining))\b/i,
  ];

  if (forceLowPatterns.some(pattern => pattern.test(text))) {
    return "low";
  }

  // FORCE HIGH - only if truly urgent AND actionable
  const forceHighPatterns = [
    /\b(interview.today|interview.tomorrow)\b/i,
    /\bdeadline.today\b/i,
    /\burgent.+action.required\b/i,
    /\bfinal.notice\b/i,
  ];

  if (forceHighPatterns.some(pattern => pattern.test(text)) && 
      !text.includes("no-reply") && 
      !text.includes("noreply")) {
    return "high";
  }

  // Trust AI for everything else
  return aiPriority;
}

// ============ FALLBACK RESPONSE ============
function getFallbackResponse(message: Message): EmailResponse {
  const { subject, snippet } = message;
  const priority = determinePriority(subject, snippet);
  const dueDate = parseDueDate(null, subject + " " + snippet, subject);

  return {
    subject,
    summary: snippet.substring(0, 200) + (snippet.length > 200 ? "..." : ""),
    priority,
    action: extractAction(snippet),
    dueDate,
  };
}

// ============ FALLBACK FUNCTIONS ============
function determinePriority(subject: string, snippet: string): "high" | "medium" | "low" {
  const text = (subject + " " + snippet).toLowerCase();
  
  // Check force-low patterns
  const lowKeywords = [
    "otp", "verification code", "tpin", "authentication", "2fa",
    "transaction statement", "receipt", "confirmation",
    "unsubscribe", "promotional", "marketing", "newsletter",
    "no-reply", "noreply", "automated"
  ];
  if (lowKeywords.some(k => text.includes(k))) return "low";
  
  // Check high priority
  const highKeywords = ["urgent", "asap", "deadline today", "interview today", "final notice"];
  if (highKeywords.some(k => text.includes(k))) return "high";
  
  return "medium";
}

function extractAction(text: string): string | null {
  const actionKeywords = ["please", "action required", "respond", "reply", "confirm", "review", "approve"];
  const lowerText = text.toLowerCase();
  for (const keyword of actionKeywords) {
    if (lowerText.includes(keyword)) {
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          return sentence.trim().substring(0, 100);
        }
      }
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

function parseDueDate(
  input: string | null | undefined,
  fullText: string,
  subject: string
): string | null {
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

// ============ CACHE MANAGEMENT ============
export function clearEmailCache() {
  emailCache.clear();
}

export function getCacheStats() {
  return {
    size: emailCache.size,
    maxSize: 1000, // Implement LRU if needed
  };
}