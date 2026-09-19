import { useState } from "react";
import type { FormEvent } from "react";
import {
  DocumentPreview,
  type PreviewDocument,
} from "../../components/documents/DocumentPreview";
import { dashboardCopy, localeFor } from "../../content/dashboardCopy";
import type {
  Ticket,
  TicketAttachment,
  TicketMessage,
} from "../../shared/domain";
import {
  labelFor,
  systemEventFor,
  ticketStatusClass,
} from "../../shared/labels";
import type { Language } from "../../shared/types";

type Props = {
  ticket: Ticket;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
  language: Language;
  userId?: string;
  error: string;
  onBack: () => void;
  onSend: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpload: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDownload: (attachment: TicketAttachment) => Promise<void>;
  onRemove: (attachment: TicketAttachment) => Promise<void>;
};

export function TicketConversation(props: Props) {
  const {
    ticket,
    messages,
    attachments,
    language,
    userId,
    error,
    onBack,
    onSend,
    onUpload,
    onDownload,
    onRemove,
  } = props;
  const t = dashboardCopy[language].ticket;
  const [preview, setPreview] = useState<PreviewDocument>();

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
        <span className={`tag ${ticketStatusClass(ticket.status)}`}>
          {labelFor(ticket.status, language)}
        </span>
      </div>
      <div className="chat">
        {messages.length ? (
          messages.map((message) => (
            <article
              key={message.id}
              className={
                message.messageType === "InternalNote" ? "internal" : ""
              }
            >
              <small>{labelFor(message.messageType, language)}</small>
              <p>
                {message.messageType === "SystemEvent"
                  ? systemEventFor(message.body, language)
                  : message.body}
              </p>
              <time>
                {new Date(message.createdAt).toLocaleString(
                  localeFor(language),
                )}
              </time>
            </article>
          ))
        ) : (
          <p>{t.noMessages}</p>
        )}
      </div>
      {ticket.finalRecommendation && (
        <article className="detail-card">
          <span className="kicker">{t.recommendation}</span>
          <p>{ticket.finalRecommendation}</p>
          {ticket.referralRecommendation && (
            <p>
              <b>{t.referral}:</b> {ticket.referralRecommendation}
            </p>
          )}
        </article>
      )}
      <form
        className="ticket-reply-form"
        onSubmit={(event) => void onSend(event)}
      >
        <label>
          <span>{t.messageLabel}</span>
          <textarea
            name="body"
            required
            rows={4}
            placeholder={t.messagePlaceholder}
          />
        </label>
        <div className="ticket-reply-actions">
          <button className="primary" type="submit">
            {t.send}
          </button>
        </div>
      </form>
      <form
        className="inline-form upload"
        onSubmit={(event) => void onUpload(event)}
      >
        <input
          name="file"
          required
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx"
        />
        <button className="secondary">{t.attach}</button>
      </form>
      <section className="detail-card">
        <h3>{t.attachments}</h3>
        {attachments.map((attachment) => (
          <article className="ticket attachment-row" key={attachment.id}>
            <div>
              <b>{attachment.originalFilename}</b>
              <small>
                {Math.ceil(attachment.sizeBytes / 1024)} KB ·{" "}
                {new Date(attachment.createdAt).toLocaleString(
                  localeFor(language),
                )}
              </small>
            </div>
            <div className="attachment-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setPreview(attachment)}
              >
                {t.preview}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => void onDownload(attachment)}
              >
                {t.download}
              </button>
              {(!attachment.uploadedBy || attachment.uploadedBy === userId) && (
                <button
                  className="secondary attachment-remove"
                  type="button"
                  onClick={() => void onRemove(attachment)}
                >
                  {language === "mk"
                    ? "Отстрани"
                    : language === "sq"
                      ? "Hiqe"
                      : "Remove"}
                </button>
              )}
            </div>
          </article>
        ))}
        {!attachments.length && <p>{t.noAttachments}</p>}
      </section>
      {preview && (
        <DocumentPreview
          document={preview}
          onClose={() => setPreview(undefined)}
        />
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
