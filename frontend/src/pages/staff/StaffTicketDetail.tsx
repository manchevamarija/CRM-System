import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { api, getAccessToken } from "../../api";
import {
  DocumentPreview,
  type PreviewDocument,
} from "../../components/documents/DocumentPreview";
import type {
  Ticket,
  TicketAttachment,
  TicketMessage,
} from "../../shared/domain";
import type { Language } from "../../shared/types";
import {
  labelFor,
  systemEventFor,
  ticketStatusClass,
} from "../../shared/labels";
import { workspaceCopy } from "../../content/workspaceCopy";
import { localeFor } from "../../content/dashboardCopy";
import type { StaffUser } from "./staffModels";

export function StaffTicketDetail({
  ticket,
  staff,
  onBack,
  onChanged,
  language,
  canAssign,
  organizationName,
}: {
  ticket: Ticket;
  staff: StaffUser[];
  onBack: () => void;
  onChanged: () => void;
  language: Language;
  canAssign: boolean;
  organizationName?: string;
}) {
  const t = workspaceCopy(language);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [preview, setPreview] = useState<PreviewDocument>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<TicketMessage[]>(`/api/tickets/${ticket.id}/messages`)
      .then(setMessages)
      .catch((reason) => setError(reason.message));
    api<TicketAttachment[]>(`/api/tickets/${ticket.id}/attachments`)
      .then(setAttachments)
      .catch((reason) => setError(reason.message));
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
    void connection
      .start()
      .then(() => connection.invoke("JoinTicket", ticket.id))
      .catch(() => setError(t.liveDisconnected));
    return () => {
      void connection.stop();
    };
  }, [ticket.id, t.liveDisconnected]);
  const downloadAttachment = async (attachment: TicketAttachment) => {
    const response = await fetch(`/api/files/${attachment.fileId}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    if (!response.ok) return setError(t.attachmentDownloadError);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.originalFilename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const uploadAttachment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File)) return;
    const payload = new FormData();
    payload.append("file", file);
    const response = await fetch(`/api/tickets/${ticket.id}/attachments`, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      body: payload,
    });
    if (!response.ok) return setError(t.attachmentUploadError);
    setAttachments(
      await api<TicketAttachment[]>(`/api/tickets/${ticket.id}/attachments`),
    );
    form.reset();
    setError("");
  };
  const post = async (
    event: FormEvent<HTMLFormElement>,
    type: "messages" | "internal-notes",
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api(`/api/staff/tickets/${ticket.id}/${type}`, {
        method: "POST",
        body: JSON.stringify({ body: data.get("body") }),
      });
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.sendError);
    }
  };
  const assign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api(`/api/staff/tickets/${ticket.id}/assign`, {
      method: "POST",
      body: JSON.stringify({
        agentId: data.get("agentId") || null,
        expertId: data.get("expertId") || null,
      }),
    });
    onChanged();
  };
  const status = async (value: string) => {
    await api(`/api/staff/tickets/${ticket.id}/status?status=${value}`, {
      method: "PATCH",
    });
    onChanged();
  };
  const resolve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api(`/api/staff/tickets/${ticket.id}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        finalRecommendation: data.get("finalRecommendation"),
        referralRecommendation: data.get("referralRecommendation"),
      }),
    });
    onChanged();
  };
  return (
    <div className="workspace">
      <button className="back-link" onClick={onBack}>
        ← {t.back}
      </button>
      <div className="workspace-head">
        <div>
          <span>#{ticket.ticketNumber}</span>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
        </div>
        <div className="ticket-head-actions">
          <span className={`tag ${ticketStatusClass(ticket.status)}`}>
            {labelFor(ticket.status, language)}
          </span>
          <div className="ticket-organization-summary">
            <span>{t.organization}</span>
            <strong>{organizationName ?? "—"}</strong>
            <small>
              {language === "mk"
                ? "Контакт: преку клиентскиот профил"
                : "Contact: via the client profile"}
            </small>
          </div>
        </div>
      </div>
      {canAssign && (
        <form className="workspace-form" onSubmit={assign}>
          <h3>{t.assignment}</h3>
          <div className="row">
            <label>
              {language === "mk" ? "Агент" : "Agent"}
              <select
                name="agentId"
                required
                defaultValue={ticket.assignedAgentId ?? ""}
              >
                <option value="">{t.choose}</option>
                {staff
                  .filter((x) => ["HelpDeskAgent", "Admin"].includes(x.role))
                  .filter(
                    (item, index, items) =>
                      items.findIndex(
                        (candidate) => candidate.id === item.id,
                      ) === index,
                  )
                  .map((item) => (
                    <option key={`${item.id}-${item.role}`} value={item.id}>
                      {item.email}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button className="primary">{t.assign}</button>
        </form>
      )}
      <div className="action-row">
        <button onClick={() => status("InProgress")}>{t.begin}</button>
        <button onClick={() => status("Closed")}>{t.close}</button>
      </div>
      <div className="chat">
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.messageType === "InternalNote" ? "internal" : ""}
          >
            <small>{labelFor(message.messageType, language)}</small>
            <p>
              {message.messageType === "SystemEvent"
                ? systemEventFor(message.body, language)
                : message.body}
            </p>
            <time>
              {new Date(message.createdAt).toLocaleString(localeFor(language))}
            </time>
          </article>
        ))}
      </div>
      <section className="detail-card ticket-attachments">
        <div className="list-head">
          <div>
            <h3>{t.attachments}</h3>
            <p>{t.attachmentsHelp}</p>
          </div>
          <span className="tag blue">{attachments.length}</span>
        </div>
        {attachments.map((attachment) => (
          <div className="approval" key={attachment.id}>
            <div>
              <b>{attachment.originalFilename}</b>
              <small>
                {Math.ceil(attachment.sizeBytes / 1024)} KB ·{" "}
                {new Date(attachment.createdAt).toLocaleString(
                  localeFor(language),
                )}
              </small>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setPreview(attachment)}
            >
              {t.preview}
            </button>
            <button
              type="button"
              onClick={() => void downloadAttachment(attachment)}
            >
              {t.download}
            </button>
          </div>
        ))}
        {!attachments.length && (
          <p className="empty-state">{t.noAttachments}</p>
        )}
        <form className="inline-form upload" onSubmit={uploadAttachment}>
          <input
            name="file"
            required
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx"
          />
          <button className="secondary">{t.attachDocument}</button>
        </form>
      </section>
      {preview && (
        <DocumentPreview
          document={preview}
          onClose={() => setPreview(undefined)}
        />
      )}
      <form
        className="ticket-reply-form workspace-form"
        onSubmit={(event) => post(event, "messages")}
      >
        <label>
          {t.replyClient}
          <textarea name="body" rows={4} required />
        </label>
        <div className="ticket-reply-actions">
          <button className="primary" type="submit">
            {t.send}
          </button>
        </div>
      </form>
      <form
        className="inline-form"
        onSubmit={(event) => post(event, "internal-notes")}
      >
        <input name="body" required placeholder={t.internalNote} />
        <button className="secondary">{t.saveNote}</button>
      </form>
      <form className="workspace-form" onSubmit={resolve}>
        <h3>{t.finalRecommendation}</h3>
        <label>
          {t.practicalRecommendation}
          <textarea name="finalRecommendation" rows={4} required />
        </label>
        <label>
          {t.referralRecommendation}
          <textarea name="referralRecommendation" rows={2} />
        </label>
        <button className="approve">{t.resolveTicket}</button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
