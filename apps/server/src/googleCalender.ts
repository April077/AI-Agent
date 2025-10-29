import { google } from "googleapis";

export async function addEventToGoogleCalendar(
  refreshToken: string,
  eventData: {
    summary: string;
    description?: string;
    dueDate: string;
  }
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event = {
    summary: eventData.summary,
    start: {
      dateTime: new Date(eventData.dueDate).toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: new Date(
        new Date(eventData.dueDate).getTime() + 60 * 60 * 1000
      ).toISOString(),
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
