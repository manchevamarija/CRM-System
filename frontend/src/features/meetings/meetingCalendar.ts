import { apiResponse } from "../../api";
import type { Meeting } from "../../shared/domain";

export async function downloadMeetingCalendar(adminMode: boolean) {
  const endpoint = adminMode
    ? "/api/admin/meetings/calendar.ics"
    : "/api/meetings/calendar.ics";
  const response = await apiResponse(endpoint);
  downloadBlob(await response.blob(), "crm-system-meetings.ics");
}

export function downloadMeetingEvent(meeting: Meeting) {
  if (!meeting.startsAt) return;

  const start = new Date(meeting.startsAt);
  const end = meeting.endsAt
    ? new Date(meeting.endsAt)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const location =
    meeting.meetingType === "Online"
      ? meeting.onlineLink || "Online"
      : meeting.location || "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM System//Portal V1//MK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@crm-system.local`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeCalendarText(meeting.subject)}`,
    `DESCRIPTION:${escapeCalendarText(meeting.description)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    `STATUS:${meeting.status === "Cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  downloadBlob(
    new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
    `crm-system-${meeting.id}.ics`,
  );
}

function formatDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
