import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { api, getAccessToken } from "../../api";
import { dashboardCopy, localeFor } from "../../content/dashboardCopy";
import { useAuth } from "../../features/auth/useAuth";
import type {
  Ticket,
  TicketAttachment,
  TicketMessage,
} from "../../shared/domain";
import { labelFor, ticketStatusClass } from "../../shared/labels";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import { TicketConversation } from "./TicketConversation";

export function TicketWorkspace({
  tickets,
  onChanged,
  canCreate,
  accessMessage,
  initialTicketId,
}: {
  tickets: Ticket[];
  onChanged: () => void;
  canCreate: boolean;
  accessMessage: string;
  initialTicketId?: string;
}) {
  const language = usePortalLanguage();
  const { user } = useAuth();
  const t = dashboardCopy[language].ticket;
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [openedInitialTicketId, setOpenedInitialTicketId] = useState<string>();

  useEffect(() => {
    if (!initialTicketId || openedInitialTicketId === initialTicketId) return;
    const ticket = tickets.find((item) => item.id === initialTicketId);
    if (!ticket) return;
    setSelected(ticket);
    setOpenedInitialTicketId(initialTicketId);
  }, [initialTicketId, openedInitialTicketId, tickets]);

  useEffect(() => {
    if (!selected) return;
    api<TicketMessage[]>(`/api/tickets/${selected.id}/messages`)
      .then(setMessages)
      .catch((e) => setError(e.message));
    api<TicketAttachment[]>(`/api/tickets/${selected.id}/attachments`)
      .then(setAttachments)
      .catch((e) => setError(e.message));
    const connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? ""}/hubs/tickets`, {
        accessTokenFactory: () => getAccessToken() ?? "",
      })
      .withAutomaticReconnect()
      .build();
    connection.on("TicketMessageCreated", (message: TicketMessage) =>
      setMessages((current) =>
        current.some((x) => x.id === message.id)
          ? current
          : [...current, message],
      ),
    );
    connection.on("TicketStatusChanged", (update: { status: string }) =>
      setSelected((current) =>
        current ? { ...current, status: update.status } : current,
      ),
    );
    connection
      .start()
      .then(() => connection.invoke("JoinTicket", selected.id))
      .catch(() => setError(t.liveError));
    return () => {
      void connection.stop();
    };
  }, [selected, t.liveError]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) {
      setError(accessMessage);
      return;
    }
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/api/tickets/", {
        method: "POST",
        body: JSON.stringify({
          category: data.get("category"),
          title: data.get("title"),
          description: data.get("description"),
          priority: data.get("priority"),
        }),
      });
      setCreating(false);
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : t.createError);
    }
  };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api(`/api/tickets/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: data.get("body") }),
      });
      form.reset();
    } catch (value) {
      setError(value instanceof Error ? value.message : t.sendError);
    }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File)) return;
    const payload = new FormData();
    payload.append("file", file);
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/tickets/${selected.id}/attachments`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: payload,
      });
      if (!response.ok) throw new Error(t.uploadError);
      setAttachments(
        await api<TicketAttachment[]>(
          `/api/tickets/${selected.id}/attachments`,
        ),
      );
      form.reset();
    } catch (value) {
      setError(value instanceof Error ? value.message : t.uploadError);
    }
  };
  const downloadAttachment = async (attachment: TicketAttachment) => {
    const token = getAccessToken();
    const response = await fetch(`/api/files/${attachment.fileId}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return setError(t.uploadError);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.originalFilename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const removeAttachment = async (attachment: TicketAttachment) => {
    const confirmation =
      language === "mk"
        ? `Дали сигурно сакате да го отстраните „${attachment.originalFilename}“?`
        : language === "sq"
          ? `Dëshironi ta hiqni dokumentin “${attachment.originalFilename}”?`
          : `Remove “${attachment.originalFilename}”?`;
    if (!window.confirm(confirmation)) return;
    try {
      await api(`/api/files/${attachment.fileId}`, { method: "DELETE" });
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      setError("");
    } catch {
      setError(
        language === "mk"
          ? "Документот не може да се отстрани. Може да ги отстраните само документите што вие сте ги прикачиле."
          : language === "sq"
            ? "Dokumenti nuk mund të hiqet. Mund të hiqni vetëm dokumentet që i keni ngarkuar ju."
            : "The document could not be removed. You can remove only documents that you uploaded.",
      );
    }
  };

  if (selected) {
    return (
      <TicketConversation
        ticket={selected}
        messages={messages}
        attachments={attachments}
        language={language}
        userId={user?.id}
        error={error}
        onBack={() => setSelected(null)}
        onSend={send}
        onUpload={upload}
        onDownload={downloadAttachment}
        onRemove={removeAttachment}
      />
    );
  }

  return (
    <div className="ticket-list">
      <div className="list-head">
        <h2>{t.myTickets}</h2>
        <button disabled={!canCreate} onClick={() => setCreating(!creating)}>
          + {t.newTicket}
        </button>
      </div>
      {!canCreate && <p className="notice padded">{accessMessage}</p>}
      {creating && canCreate && (
        <form className="workspace-form" onSubmit={create}>
          <div className="row">
            <label>
              {t.category}
              <select name="category">
                {(
                  [
                    "AI_READINESS",
                    "AI_ACT_COMPLIANCE",
                    "AI_USE_CASE",
                    "DATA_GOVERNANCE",
                    "AUTOMATION_AND_INTELLIGENCE",
                    "TEST_BEFORE_INVEST",
                    "DIGITALIZATION_ROADMAP",
                    "TRAINING_AND_SKILLS",
                    "FUNDING_AND_INVESTMENT",
                    "REFERRAL",
                    "OTHER",
                  ] as const
                ).map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value, language)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.priority}
              <select name="priority">
                {(["Normal", "High", "Low", "Urgent"] as const).map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value, language)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {t.title}
            <input name="title" required />
          </label>
          <label>
            {t.description}
            <textarea name="description" rows={5} required />
          </label>
          <button className="primary">{t.create}</button>
        </form>
      )}
      {tickets.map((ticket) => (
        <button
          className="ticket ticket-button"
          key={ticket.id}
          onClick={() => setSelected(ticket)}
        >
          <span className={`tag ${ticketStatusClass(ticket.status)}`}>
            {labelFor(ticket.status, language)}
          </span>
          <div>
            <b>{ticket.title}</b>
            <small>
              #{ticket.ticketNumber} · {labelFor(ticket.category, language)}
            </small>
          </div>
          <span>
            {new Date(ticket.updatedAt).toLocaleDateString(localeFor(language))}
          </span>
        </button>
      ))}
      {!tickets.length && <div className="empty-state">{t.empty}</div>}
      {error && <p className="form-error padded">{error}</p>}
    </div>
  );
}
