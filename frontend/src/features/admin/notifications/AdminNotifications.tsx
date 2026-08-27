import type { Language } from "../../../shared/types";
import { labelFor } from "../../../shared/labels";
import { localeFor } from "../../../content/dashboardCopy";
import type { AdminNotification, User } from "../../../pages/admin/adminModels";

type Props = {
  language: Language;
  notifications: AdminNotification[];
  users: User[];
  retryingId?: string;
  onRetry: (id: string) => Promise<void>;
};

export function AdminNotifications({
  language,
  notifications,
  users,
  retryingId,
  onRetry,
}: Props) {
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;

  return (
    <div className="ticket-list">
      <div className="list-head">
        <div>
          <h2>
            {text(
              "Ред за испраќање е-пораки",
              "Email delivery queue",
              "Radha e dërgimit të email-eve",
            )}
          </h2>
          <small className="calendar-help">
            {text(
              "Автоматските пораки се испраќаат преку SMTP. Кога контакт-барањето има потврда, PDF документот се испраќа како прилог во самата е-пошта.",
              "Automated messages are sent through SMTP. When a contact request has a confirmation, the PDF document is sent as an email attachment.",
              "Mesazhet automatike dërgohen përmes SMTP. Kur kërkesa ka konfirmim, dokumenti PDF dërgohet si bashkëngjitje në email.",
            )}
          </small>
        </div>
        <span>{notifications.length ?? 0}</span>
      </div>
      {notifications.map((item) => (
        <div className="approval" key={item.id}>
          <span
            className={`tag ${item.status === "Failed" ? "amber" : "blue"}`}
          >
            {labelFor(item.status, language)}
          </span>
          <div>
            <b>{item.subject}</b>
            <small>
              {item.recipientEmail ??
                users.find((userItem) => userItem.id === item.recipientUserId)
                  ?.email ??
                item.recipientUserId ??
                "—"}{" "}
              · {item.type} ·{" "}
              {new Date(item.createdAt).toLocaleString(localeFor(language))}
            </small>
            {item.lastError && <small>{item.lastError}</small>}
          </div>
          {item.status === "Failed" && (
            <button
              className="approve"
              disabled={retryingId === item.id}
              onClick={() => void onRetry(item.id)}
            >
              {retryingId === item.id
                ? text("Се закажува...", "Queuing...", "Duke vendosur në radhë...")
                : text("Обиди се повторно", "Retry", "Provo përsëri")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
