# Calendar sync (CRM ↔ Google/Outlook)

Each staff member can connect their own Google or Microsoft calendar. Once connected,
confirming a meeting in the CRM automatically creates the matching event in that person's
calendar, with the requesting client added as an attendee — Google/Microsoft handle
sending the actual invitation email to the client. The CRM never sends its own
calendar-invite email for this.

This is a per-person setting: 500 clients is not a problem, because every meeting already
carries its own client and assigned-staff association (`Meeting.OrganizationId`,
`Meeting.RequestedByUserId`, `Meeting.AssignedUserId`) — calendar sync only automates the
step of pushing that already-known pairing into a calendar; it never has to guess who a
meeting belongs to.

## What's implemented — stage 1 (CRM → Google/Outlook)

- `POST /api/staff/calendar/connect/{provider}` (`google` or `microsoft`) — redirects the
  signed-in staff member through that provider's consent screen.
- `GET /api/staff/calendar/callback/{provider}` — the provider redirects here after
  consent; exchanges the code for tokens and stores a `CalendarConnection` row.
- `GET /api/staff/calendar/status` / `POST /api/staff/calendar/disconnect/{provider}` — see
  and remove a connection. Surfaced in the staff Meetings tab as "Поврзи Google Calendar" /
  "Поврзи Outlook" buttons.
- When a meeting is confirmed (`StaffMeetingsController` → operation `confirm`),
  `CalendarSyncService.PushMeetingAsync` runs: if the assigned staff member has a connected
  calendar, it creates the event there with the client's email as an attendee. If they
  haven't connected anything, this silently does nothing — connecting a calendar is
  optional per person, not required to use meetings at all. A push failure never blocks
  confirming the meeting itself, only the calendar entry doesn't get created that time.
- Access/refresh tokens are stored encrypted (ASP.NET Data Protection), never in plain
  text. Access tokens are refreshed automatically when expired.

## Required external setup (done once, by the account owner)

Two OAuth apps need to be registered — this can't be done by anyone but the account owner
in Google Cloud Console / Azure Portal, and is separate from this codebase entirely:

1. **Google**: Google Cloud Console → new project → enable "Google Calendar API" → OAuth
   client credentials → note the Client ID and Client Secret.
2. **Microsoft**: Azure Portal → Microsoft Entra ID → App registrations → New registration
   → API permissions → add `Calendars.ReadWrite` → Certificates & secrets → New client
   secret → note the Application (client) ID, Directory (tenant) ID, and the secret Value.

Both apps need their redirect URI registered to match this deployment exactly:
- Google: `https://<APP_PUBLIC_URL>/api/staff/calendar/callback/google`
- Microsoft: `https://<APP_PUBLIC_URL>/api/staff/calendar/callback/microsoft`

## Configuration

Add to `.env.production` (not required for the CRM to run — only for this feature):

```
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
MS_CALENDAR_CLIENT_ID=...
MS_CALENDAR_CLIENT_SECRET=...
MS_CALENDAR_TENANT_ID=...
```

## Stage 2 — Google/Outlook → CRM (implemented)

A background job (`CalendarPullSyncJob`, every 10 minutes) reads each connected calendar's
events for the next 30 days:

- An event the CRM itself pushed (its id already stored on a `Meeting.ExternalEventId`) is
  skipped — never re-imported as if it were new.
- If the event's attendee email matches an existing CRM contact **with an organization**,
  a `Meeting` is created automatically, linked to that contact and their organization,
  assigned to the staff member who owns the calendar, status `Confirmed`.
- If the attendee email is unknown (or matches a user with no organization yet), the event
  is filed in `UnmatchedCalendarEvent` with status `Pending` — the CRM never invents an
  organization from a bare email address.

Admins resolve these from the **Непрепознаени календарски настани** panel (top of the
admin Meetings tab, only visible when there's something pending): either pick an existing
organization and contact, or click "Нов клиент" to create a brand-new client (and
organization, if needed) straight from the event's attendee email — this reuses the exact
same account-creation path as the Users screen (temporary password, activation email).
"Игнорирај" marks it `Ignored` (e.g. a personal event with no client at all). Once resolved
or ignored, that specific event is never brought back on a later sync — only a genuinely
new external event triggers a fresh row.

`GET/POST /api/admin/calendar/unmatched-events...` (Admin policy) power this panel.

### Notes

- Every non-self attendee is checked against known contacts, not just the first one — if
  any attendee matches an existing user (with an organization), that's who the meeting is
  linked to.
- Microsoft Graph requests send `Prefer: outlook.timezone="UTC"`, so pulled event times are
  exact, not approximated.
- Creating a new client from an unmatched event still requires providing an organization
  name and contact name — the CRM never auto-creates an account from just a bare email with
  no admin confirming the details.
