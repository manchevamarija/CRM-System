import { useEffect, useState } from "react";
import { api } from "../../../api";
import type { Language } from "../../../shared/types";

type Attachment = {
  id: string;
  fileId: string;
  originalFilename: string;
  contentType: string;
};

type Props = {
  contactRequestId: string;
  language: Language;
};

export function ContactRequestDocuments({ contactRequestId, language }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const mk = language === "mk";

  useEffect(() => {
    void api<Attachment[]>(
      `/api/admin/contact-requests/${contactRequestId}/attachments`,
    )
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [contactRequestId]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file") as File | null;
    if (!file?.size) return;

    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const attachment = await api<Attachment>(
        `/api/admin/contact-requests/${contactRequestId}/attachments`,
        { method: "POST", body: data },
      );
      setAttachments((items) => [attachment, ...items]);
      form.reset();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="contact-action-group contact-action-wide contact-documents">
      <span className="contact-action-label">
        {mk ? "Документи за контакт-барањето" : "Contact request documents"}
      </span>
      <form className="inline-form" onSubmit={upload}>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        />
        <button className="primary" disabled={uploading}>
          {uploading
            ? mk
              ? "Се додава…"
              : "Uploading…"
            : mk
              ? "Додади документ"
              : "Add document"}
        </button>
      </form>
      {attachments.length > 0 && (
        <div className="contact-document-list">
          {attachments.map((file) => (
            <a
              key={file.id}
              href={`/api/files/${file.fileId}`}
              target="_blank"
              rel="noreferrer"
            >
              {file.originalFilename}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
