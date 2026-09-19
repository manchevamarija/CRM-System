import { localeFor } from "../../../content/dashboardCopy";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { Language } from "../../../shared/types";
import type { AdminAttachment } from "../../../pages/admin/adminModels";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  attachments: AdminAttachment[];
  loading: boolean;
  onPreview: (attachment: AdminAttachment) => void;
  onDownload: (attachment: AdminAttachment) => Promise<void>;
};

export function AdminDocuments({
  t,
  language,
  attachments,
  loading,
  onPreview,
  onDownload,
}: Props) {
  return (
    <div className="ticket-list document-list">
      <div className="list-head">
        <div>
          <h2>{t.allTicketDocuments}</h2>
          <p>{t.allTicketDocumentsHelp}</p>
        </div>
        <span className="tag blue">{attachments.length}</span>
      </div>
      {attachments.map((attachment) => (
        <div className="approval" key={attachment.id}>
          <span className="tag blue">
            {attachment.contentType === "application/pdf" ? "PDF" : t.file}
          </span>
          <div>
            <b>{attachment.originalFilename}</b>
            <small>
              {attachment.sourceType ? `${attachment.sourceType} · ` : ""}#
              {attachment.ticketNumber} · {attachment.ticketTitle} ·{" "}
              {attachment.organizationName}
            </small>
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
            onClick={() => onPreview(attachment)}
          >
            {t.preview}
          </button>
          <button type="button" onClick={() => void onDownload(attachment)}>
            {t.download}
          </button>
        </div>
      ))}
      {!loading && !attachments.length && (
        <div className="empty-state">
          <h3>{t.noTicketDocuments}</h3>
          <p>{t.noTicketDocumentsHelp}</p>
        </div>
      )}
    </div>
  );
}
