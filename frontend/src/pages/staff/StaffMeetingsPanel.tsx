import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, apiResponse } from "../../api";
import { localeFor } from "../../content/dashboardCopy";
import { workspaceCopy } from "../../content/workspaceCopy";
import type { Meeting } from "../../shared/domain";
import { labelFor } from "../../shared/labels";
import { useApiResource } from "../../shared/useApiResource";
import type { Language } from "../../shared/types";
import type { StaffUser } from "./staffModels";
import type {
  AdminClient,
  AdminOrganization,
} from "../../features/meetings/meetingModels";

type Props = {
  meetings: Meeting[];
  loading: boolean;
  staff: StaffUser[];
  canTriage: boolean;
  canSchedule: boolean;
  language: Language;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function StaffMeetingsPanel(props: Props) {
  const {
    meetings,
    loading,
    staff,
    canTriage,
    canSchedule,
    language,
    onChanged,
    onError,
  } = props;
  const t = workspaceCopy(language);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);
  const adminClients = useApiResource<AdminClient[]>(
    "/api/admin/users",
    canSchedule,
  );
  const adminOrganizations = useApiResource<AdminOrganization[]>(
    "/api/admin/organizations",
    canSchedule,
  );
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const calendarDays = useMemo(() => {
    const first = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1,
    );
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const meetingTone = (item: Meeting) =>
    item.status === "Confirmed" || item.status === "Completed"
      ? "meeting-confirmed"
      : item.status === "Cancelled" || item.status === "Rejected"
        ? "meeting-cancelled"
        : "meeting-scheduled";
  const upcoming = meetings
    .filter((item) => item.startsAt && new Date(item.startsAt) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime(),
    )
    .slice(0, 5);

  const submit = async (
    event: FormEvent<HTMLFormElement>,
    meeting: Meeting,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value || "confirm";
    try {
      const start = String(data.get("startsAt") ?? "");
      const end = String(data.get("endsAt") ?? "");
      await api(`/api/staff/meetings/${meeting.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          startsAt: start ? new Date(start).toISOString() : null,
          endsAt: end ? new Date(end).toISOString() : null,
          location: data.get("location"),
          onlineLink: data.get("onlineLink"),
          notes: data.get("notes"),
          assignedUserId: data.get("assignedUserId") || null,
          organizationId: data.get("organizationId") || null,
        }),
      });
      setEditing(null);
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : t.decisionError);
    }
  };

  const schedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const userId = String(data.get("clientUserId") ?? "");
    const client = (adminClients.data ?? []).find((item) => item.id === userId);
    const organization = (adminOrganizations.data ?? []).find(
      (item) => item.id === client?.organizationId,
    );
    const start = String(data.get("preferredStart") ?? "");
    const end = String(data.get("preferredEnd") ?? "");
    try {
      await api("/api/admin/meetings", {
        method: "POST",
        body: JSON.stringify({
          userId,
          meeting: {
            subject: String(
              data.get("subject") ||
                `Состанок со ${organization?.name ?? "клиент"}`,
            ),
            description: data.get("description"),
            meetingType: data.get("meetingType"),
            preferredStart: start ? new Date(start).toISOString() : null,
            preferredEnd: end ? new Date(end).toISOString() : null,
            requestedTimeWindow: data.get("requestedTimeWindow"),
            location: data.get("location"),
            notes: data.get("notes"),
          },
        }),
      });
      setCreating(false);
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : t.decisionError);
    }
  };

  const action = async (meeting: Meeting, name: "reject" | "complete") => {
    try {
      await api(`/api/staff/meetings/${meeting.id}/${name}`, {
        method: "POST",
        body: "{}",
      });
      setEditing(null);
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : t.decisionError);
    }
  };

  const downloadCalendar = async () => {
    const response = await apiResponse(
      "/api/staff/meetings/calendar.ics",
    ).catch(() => null);
    if (!response) return onError(t.reportDownloadError);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "crm-system-staff-calendar.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="staff-calendar-workspace">
      <div className="calendar-toolbar">
        <div>
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth() - 1,
                  1,
                ),
              )
            }
          >
            ‹
          </button>
          <button type="button" onClick={() => setVisibleMonth(new Date())}>
            {text("Денес", "Today", "Sot")}
          </button>
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth() + 1,
                  1,
                ),
              )
            }
          >
            ›
          </button>
        </div>
        <h2>
          {new Intl.DateTimeFormat(localeFor(language), {
            month: "long",
            year: "numeric",
          }).format(visibleMonth)}
        </h2>
        <div className="calendar-toolbar-actions">
          {canSchedule && (
            <button
              className="primary calendar-create"
              type="button"
              onClick={() => setCreating(true)}
            >
              + {text("Додади состанок", "Add meeting", "Shto takim")}
            </button>
          )}
          <button
            className="secondary calendar-download"
            onClick={() => void downloadCalendar()}
          >
            ↓ {t.downloadCalendar}
          </button>
        </div>
      </div>
      <div className="calendar-content-grid">
        <section className="month-calendar">
          <div className="calendar-weekdays">
            {(language === "mk"
              ? ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"]
              : language === "sq"
                ? ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"]
                : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            ).map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {calendarDays.map((day) => {
              const events = meetings.filter(
                (item) =>
                  item.startsAt &&
                  dayKey(new Date(item.startsAt)) === dayKey(day),
              );
              const today = dayKey(day) === dayKey(new Date());
              return (
                <div
                  className={`${day.getMonth() === visibleMonth.getMonth() ? "" : "outside"} ${today ? "today" : ""}`}
                  key={day.toISOString()}
                >
                  <time>{day.getDate()}</time>
                  {events.slice(0, 3).map((item) => (
                    <button
                      type="button"
                      className={`calendar-event ${meetingTone(item)}`}
                      key={item.id}
                      onClick={() => setEditing(item)}
                    >
                      <b>
                        {item.startsAt
                          ? new Intl.DateTimeFormat(localeFor(language), {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.startsAt))
                          : ""}
                      </b>
                      <span>{item.subject}</span>
                    </button>
                  ))}
                  {events.length > 3 && <small>+{events.length - 3}</small>}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="upcoming-meetings">
          <div>
            <span className="kicker">
              {text("РАСПОРЕД", "SCHEDULE", "ORARI")}
            </span>
            <h3>
              {text(
                "Следни состаноци",
                "Upcoming meetings",
                "Takimet e ardhshme",
              )}
            </h3>
          </div>
          {upcoming.map((meeting) => (
            <button
              type="button"
              key={meeting.id}
              onClick={() => setEditing(meeting)}
            >
              <time>
                {new Intl.DateTimeFormat(localeFor(language), {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(meeting.startsAt!))}
              </time>
              <b>{meeting.subject}</b>
              <small>{labelFor(meeting.status, language)}</small>
            </button>
          ))}
          {!loading && !upcoming.length && (
            <div className="calendar-empty">
              <span>○</span>
              <b>{t.noMeetings}</b>
              <small>
                {text(
                  "Новите термини ќе се појават тука.",
                  "New appointments will appear here.",
                  "Takimet e reja do të shfaqen këtu.",
                )}
              </small>
            </div>
          )}
        </aside>
      </div>
      {editing && (
        <div
          className="meeting-edit-overlay"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setEditing(null)
          }
        >
          <section
            className="workspace meeting-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={editing.subject}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="meeting-edit-heading">
              <div>
                <span className={`meeting-status-chip ${meetingTone(editing)}`}>
                  {labelFor(editing.status, language)}
                </span>
                <span className="kicker">{t.calendarMeetings}</span>
                <h2>{editing.subject}</h2>
                <small>
                  {(() => {
                    const client = (adminClients.data ?? []).find(
                      (item) => item.id === editing.requestedByUserId,
                    );
                    const org = (adminOrganizations.data ?? []).find(
                      (item) => item.id === editing.organizationId,
                    );
                    return client
                      ? `${text("Клиент", "Client", "Klient")}: ${`${client.firstName} ${client.lastName}`.trim() || client.email}${org ? ` · ${text("Организација", "Organization", "Organizata")}: ${org.name}` : ` · ${text("Организација се избира подолу", "Organization selected below", "Organizata zgjidhet më poshtë")}`}`
                      : "";
                  })()}
                </small>
              </div>
              <button
                className="secondary meeting-dialog-close"
                onClick={() => setEditing(null)}
              >
                {text("Затвори", "Close", "Mbyll")}
              </button>
            </div>
            <form
              className="workspace-form meeting-edit-form"
              onSubmit={(event) => void submit(event, editing)}
            >
              <div className="row">
                <label>
                  {t.start}
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={editing.startsAt?.slice(0, 16)}
                  />
                </label>
                <label>
                  {t.end}
                  <input
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={editing.endsAt?.slice(0, 16)}
                  />
                </label>
              </div>
              {canTriage && (
                <label>
                  {t.assignedAdvisor}
                  <select name="assignedUserId">
                    <option value="">{t.choose}</option>
                    {staff.map((item) => (
                      <option value={item.id} key={`${item.id}-${item.role}`}>
                        {item.email} · {item.role}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {canSchedule && (
                <label>
                  {text("Организација", "Organization", "Organizata")}
                  <select
                    name="organizationId"
                    defaultValue={
                      editing.organizationId ===
                      "00000000-0000-0000-0000-000000000000"
                        ? ""
                        : editing.organizationId
                    }
                  >
                    <option value="">
                      {text(
                        "Изберете организација",
                        "Choose organization",
                        "Zgjidhni organizatën",
                      )}
                    </option>
                    {(adminOrganizations.data ?? []).map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {t.location}
                <input name="location" defaultValue={editing.location} />
              </label>
              <label>
                {t.onlineLink}
                <input
                  name="onlineLink"
                  type="url"
                  defaultValue={editing.onlineLink}
                />
              </label>
              <label>
                {t.notes}
                <textarea name="notes" defaultValue={editing.notes} />
              </label>
              <div className="action-row">
                <button
                  className="approve"
                  name="meetingAction"
                  value="confirm"
                >
                  {t.confirm}
                </button>
                <button
                  className="secondary"
                  name="meetingAction"
                  value="propose"
                >
                  {text(
                    "Предложи друг термин",
                    "Propose another time",
                    "Propozo një orar tjetër",
                  )}
                </button>
                <button
                  type="button"
                  className="reject"
                  onClick={() => void action(editing, "reject")}
                >
                  {t.reject}
                </button>
                {editing.status === "Confirmed" && (
                  <button
                    type="button"
                    onClick={() => void action(editing, "complete")}
                  >
                    {t.complete}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
      {creating && (
        <div
          className="meeting-edit-overlay"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCreating(false)
          }
        >
          <section
            className="workspace meeting-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={text("Додади состанок", "Add meeting", "Shto takim")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="meeting-edit-heading">
              <div>
                <span className="kicker">
                  {text("НОВ СОСТАНОК", "NEW MEETING", "TAKIM I RI")}
                </span>
                <h2>{text("Додади состанок", "Add meeting", "Shto takim")}</h2>
              </div>
              <button
                className="secondary meeting-dialog-close"
                type="button"
                onClick={() => setCreating(false)}
              >
                {text("Затвори", "Close", "Mbyll")}
              </button>
            </div>
            <form
              className="workspace-form meeting-edit-form"
              onSubmit={(event) => void schedule(event)}
            >
              <label>
                {text(
                  "Клиент и организација",
                  "Client and organization",
                  "Klienti dhe organizata",
                )}
                <select name="clientUserId" required defaultValue="">
                  <option value="">
                    {text(
                      "Изберете клиент",
                      "Choose a client",
                      "Zgjidhni klientin",
                    )}
                  </option>
                  {(adminClients.data ?? [])
                    .filter(
                      (client) =>
                        client.status === "Active" &&
                        client.roles.includes("Client"),
                    )
                    .map((client) => {
                      const org = (adminOrganizations.data ?? []).find(
                        (item) => item.id === client.organizationId,
                      );
                      return (
                        <option value={client.id} key={client.id}>
                          {`${client.firstName} ${client.lastName}`.trim() ||
                            client.email}
                          {org
                            ? ` · ${org.name}`
                            : ` · ${text("без доделена организација", "organization pending", "organizata në pritje")}`}
                        </option>
                      );
                    })}
                </select>
              </label>
              <label>
                {text("Тема", "Subject", "Tema")}
                <input
                  name="subject"
                  placeholder={text(
                    "Состанок со организацијата",
                    "Meeting with organization",
                    "Takim me organizatën",
                  )}
                />
              </label>
              <label>
                {text("Опис", "Description", "Përshkrim")}
                <textarea name="description" rows={3} required />
              </label>
              <div className="row">
                <label>
                  {text("Тип", "Type", "Lloji")}
                  <select name="meetingType">
                    <option value="Online">
                      {text("Онлајн", "Online", "Online")}
                    </option>
                    <option value="Onsite">
                      {text("Во живо", "Onsite", "Fizikisht")}
                    </option>
                  </select>
                </label>
                <label>
                  {text("Термин", "Time", "Termini")}
                  <input name="preferredStart" type="datetime-local" required />
                </label>
              </div>
              <label>
                {text("Крај", "End", "Fundi")}
                <input name="preferredEnd" type="datetime-local" required />
              </label>
              <label>
                {text(
                  "Локација / линк",
                  "Location / link",
                  "Vendndodhja / lidhja",
                )}
                <input name="location" />
              </label>
              <label>
                {text("Белешки", "Notes", "Shënime")}
                <textarea name="notes" rows={2} />
              </label>
              <div className="action-row">
                <button className="primary">
                  {text("Зачувај состанок", "Save meeting", "Ruaj takimin")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
