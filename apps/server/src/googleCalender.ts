import { google } from "googleapis";

export async function addEventToGoogleCalendar(
  refreshToken: string,
  eventData: {
    summary: string;
    description?: string;
    dueDate: string; // e.g. "2025-10-30"
    dueTime: string; // e.g. "15:30" or "3:30 PM"
  }
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // 🕒 Combine date + time (with fallback)
  let startDateTime: Date;
  if (eventData.dueTime) {
    // If time is given, combine with date (handles both "15:30" and "3:30 PM")
    const timeString = eventData.dueTime.toUpperCase().includes("AM") ||
      eventData.dueTime.toUpperCase().includes("PM")
      ? new Date(`${eventData.dueDate} ${eventData.dueTime}`)
      : new Date(`${eventData.dueDate}T${eventData.dueTime}`);

    startDateTime = new Date(timeString);
  } else {
    // fallback if no time
    startDateTime = new Date(eventData.dueDate);
  }

  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // default +1 hour

  const event = {
    summary: eventData.summary,
    description: eventData.description || "",
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    conferenceData: {
      createRequest: { requestId: `${Date.now()}` },
    },
  };

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
    conferenceDataVersion: 1,
  });

  return res.data.htmlLink;
}

export function isMeetingEmail(subject: string, body: string): boolean {
  const text = (subject + " " + body).toLowerCase();
  const keywords = [
    "meeting",
    "call",
    "appointment",
    "discussion",
    "conference",
    "join via",
    "zoom",
    "google meet",
  ];
  return keywords.some((k) => new RegExp(`\\b${k}\\b`, "i").test(text));
}
