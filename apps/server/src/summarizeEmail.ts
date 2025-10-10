import axios from "axios";

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
          {
            role: "system",
            content: "You are an email analyzer. Always respond with valid JSON only, no markdown formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
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

    const content = response.data.choices[0].message.content;
    let cleanContent = content.trim()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");
    
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    const parsedData = JSON.parse(cleanContent);

    return {
      subject,
      summary: parsedData.summary || snippet.substring(0, 200),
      priority: parsedData.priority || "medium",
      action: parsedData.action || null,
      dueDate: parsedData.dueDate || null,
    };

  } catch (error: any) {
    console.error("AI summarization failed, using fallback:", error.message);
    
    const fallback = simpleParseEmail(snippet, subject);
    
    return {
      subject,
      summary: fallback.summary || snippet.substring(0, 200),
      priority: fallback.priority || "medium",
      action: fallback.action || null,
      dueDate: fallback.dueDate || null,
    };
  }
}

function simpleParseEmail(snippet: string, subject: string): Partial<EmailResponse> {
  return {
    summary: snippet.substring(0, 200) + (snippet.length > 200 ? "..." : ""),
    priority: determinePriority(subject, snippet),
    action: extractAction(snippet),
    dueDate: extractDate(snippet),
  };
}

function determinePriority(subject: string, snippet: string): "high" | "medium" | "low" {
  const text = (subject + " " + snippet).toLowerCase();
  
  const highPriorityKeywords = [
    "urgent", "asap", "immediate", "critical", "important", "deadline",
    "meeting", "interview", "promotion", "due", "expires", "action required"
  ];
  const lowPriorityKeywords = [
    "fyi", "newsletter", "update", "notification", "promotional",
    "unsubscribe", "marketing", "sale", "offer", "deal"
  ];
  
  if (highPriorityKeywords.some(keyword => text.includes(keyword))) {
    return "high";
  }
  if (lowPriorityKeywords.some(keyword => text.includes(keyword))) {
    return "low";
  }
  return "medium";
}

function extractAction(text: string): string | null {
  const actionKeywords = [
    "please", "action required", "respond", "reply", "confirm", 
    "review", "approve", "meeting", "attend", "prepare", "submit"
  ];
  const lowerText = text.toLowerCase();
  
  for (const keyword of actionKeywords) {
    if (lowerText.includes(keyword)) {
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          return sentence.trim().substring(0, 100);
        }
      }
      return `Action: ${keyword}`;
    }
  }
  return null;
}

function extractDate(text: string): string | null {
  const datePatterns = [
    /\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)[,\s]+\d{4}/i,
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?[,\s]+\d{4}/i,
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    /\d{4}-\d{2}-\d{2}/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}