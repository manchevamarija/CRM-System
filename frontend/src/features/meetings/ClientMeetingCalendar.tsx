import { useMemo, useState } from "react";
import { api } from "../../api";
import { localeFor } from "../../content/dashboardCopy";
import type { Meeting } from "../../shared/domain";
import { labelFor } from "../../shared/labels";
export function ClientMeetingCalendar({
  meetings,
  language,
  onRequest,
  onChanged,
}: {
  meetings: Meeting[];
  language: "mk" | "en" | "sq";
  onRequest: () => void;
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting>();
  const [actionError, setActionError] = useState("");
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);
  const key = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const meetingTone = (item: Meeting) =>
    item.status === "Confirmed" || item.status === "Completed"
      ? "meeting-confirmed"
      : item.status === "Cancelled" || item.status === "Rejected"
        ? "meeting-cancelled"
        : "meeting-scheduled";
  const week =
    language === "mk"
      ? ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"]
      : language === "sq"
        ? ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const upcoming = meetings
    .filter((item) => item.startsAt && new Date(item.startsAt) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime(),
    )
    .slice(0, 4);
  const confirm = async (id: string) => {
    try {
      setActionError("");
      await api(`/api/meetings/${id}/confirm`, { method: "POST" });
      setSelectedMeeting(undefined);
      onChanged();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : text(
              "Потврдата не успеа.",
              "Confirmation failed.",
              "Konfirmimi dështoi.",
            ),
      );
    }
  };
  const cancel = async (id: string) => {
    try {
      setActionError("");
      await api(`/api/meetings/${id}/cancel`, { method: "POST" });
      setSelectedMeeting(undefined);
      onChanged();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : text(
              "Откажувањето не успеа.",
              "Cancellation failed.",
              "Anulimi dështoi.",
            ),
      );
    }
  };
  return (
    <section className="client-calendar-workspace">
      <div className="calendar-toolbar">
        <div>
          <button
            type="button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <button type="button" onClick={() => setMonth(new Date())}>
            {text("Денес", "Today", "Sot")}
          </button>
          <button
            type="button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
        <h2>
          {new Intl.DateTimeFormat(localeFor(language), {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h2>
        <div className="calendar-toolbar-actions">
          <button
            type="button"
            className="primary calendar-create"
            onClick={onRequest}
          >
            + {text("Побарај состанок", "Request meeting", "Kërko takim")}
          </button>
        </div>
      </div>
      <div className="calendar-content-grid">
        <section className="month-calendar">
          <div className="calendar-weekdays">
            {week.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const events = meetings.filter(
                (item) =>
                  item.startsAt && key(new Date(item.startsAt)) === key(day),
              );
              const today = key(day) === key(new Date());
              return (
                <div
                  className={`${day.getMonth() === month.getMonth() ? "" : "outside"} ${today ? "today" : ""}`}
                  key={day.toISOString()}
                >
                  <time>{day.getDate()}</time>
                  {events.slice(0, 3).map((item) => (
                    <button
                      type="button"
                      className={`calendar-client-event ${meetingTone(item)}`}
                      key={item.id}
                      onClick={() => setSelectedMeeting(item)}
                    >
                      <b>
                        {new Intl.DateTimeFormat(localeFor(language), {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.startsAt!))}
                      </b>
                      <span>{item.subject}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="upcoming-meetings">
          <div>
            <span className="kicker">
              {text("МОИ СОСТАНОЦИ", "MY MEETINGS", "TAKIMET E MIA")}
            </span>
            <h3>
              {text(
                "Следни состаноци",
                "Upcoming meetings",
                "Takimet e ardhshme",
              )}
            </h3>
          </div>
          {upcoming.map((item) => (
            <button
              type="button"
              className={`calendar-upcoming-item ${meetingTone(item)}`}
              key={item.id}
              onClick={() => setSelectedMeeting(item)}
            >
              <time>
                {new Intl.DateTimeFormat(localeFor(language), {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(item.startsAt!))}
              </time>
              <b>{item.subject}</b>
              <small>{labelFor(item.status, language)}</small>
            </button>
          ))}
          {!upcoming.length && (
            <div className="calendar-empty">
              <span>○</span>
              <b>
                {text(
                  "Нема закажани состаноци",
                  "No scheduled meetings",
                  "Nuk ka takime të caktuara",
                )}
              </b>
              <small>
                {text(
                  "Побарајте термин и тој ќе се појави тука.",
                  "Request a time and it will appear here.",
                  "Kërkoni një termin dhe do të shfaqet këtu.",
                )}
              </small>
            </div>
          )}
        </aside>
      </div>
      {selectedMeeting && (
        <div
          className="meeting-edit-overlay"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            setSelectedMeeting(undefined)
          }
        >
          <section
            className="workspace meeting-edit-dialog client-meeting-details"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="meeting-edit-heading">
              <div>
                <span
                  className={`meeting-status-chip ${meetingTone(selectedMeeting)}`}
                >
                  {labelFor(selectedMeeting.status, language)}
                </span>
                <span className="kicker">
                  {text(
                    "ДЕТАЛИ ЗА СОСТАНОКОТ",
                    "MEETING DETAILS",
                    "DETAJET E TAKIMIT",
                  )}
                </span>
                <h2>{selectedMeeting.subject}</h2>
              </div>
              <button
                className="secondary meeting-dialog-close"
                type="button"
                onClick={() => {
                  setActionError("");
                  setSelectedMeeting(undefined);
                }}
              >
                {text("Затвори", "Close", "Mbyll")}
              </button>
            </div>
            <dl>
              <div>
                <dt>{text("Термин", "Time", "Termini")}</dt>
                <dd>
                  {selectedMeeting.startsAt
                    ? new Date(selectedMeeting.startsAt).toLocaleString(
                        localeFor(language),
                      )
                    : text(
                        "Ќе биде потврден",
                        "To be confirmed",
                        "Do të konfirmohet",
                      )}
                </dd>
              </div>
              <div>
                <dt>{text("Со кого", "With whom", "Me kë")}</dt>
                <dd>
                  {selectedMeeting.assignedUserName ??
                    text(
                      "Ќе биде доделен советник",
                      "An advisor will be assigned",
                      "Do të caktohet një këshilltar",
                    )}
                </dd>
              </div>
              <div>
                <dt>{text("Тип", "Type", "Lloji")}</dt>
                <dd>{labelFor(selectedMeeting.meetingType, language)}</dd>
              </div>
              {selectedMeeting.location && (
                <div>
                  <dt>{text("Локација", "Location", "Vendndodhja")}</dt>
                  <dd>{selectedMeeting.location}</dd>
                </div>
              )}
            </dl>
            <p>{selectedMeeting.description}</p>
            <div className="meeting-card-actions">
              {selectedMeeting.status === "Requested" && (
                <button
                  className="approve"
                  type="button"
                  onClick={() => void confirm(selectedMeeting.id)}
                >
                  {text("Потврди", "Confirm", "Konfirmo")}
                </button>
              )}
              {!["Completed", "Cancelled", "Rejected"].includes(
                selectedMeeting.status,
              ) && (
                <button
                  className="reject"
                  type="button"
                  onClick={() => void cancel(selectedMeeting.id)}
                >
                  {text("Откажи", "Cancel", "Anulo")}
                </button>
              )}
              {selectedMeeting.onlineLink && (
                <a
                  className="primary"
                  href={selectedMeeting.onlineLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text(
                    "Отвори онлајн врска",
                    "Open online link",
                    "Hap lidhjen online",
                  )}
                </a>
              )}
            </div>
            {actionError && <p className="form-error">{actionError}</p>}
          </section>
        </div>
      )}
    </section>
  );
}
