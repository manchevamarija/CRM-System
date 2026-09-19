import { useEffect, useState } from "react";
import { api, getAccessToken } from "../../../api";
import type { Language } from "../../../shared/types";
import { DocumentPreview, type PreviewDocument } from "../../../components/documents/DocumentPreview";

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
  const [preview, setPreview] = useState<PreviewDocument>();
  const [error, setError] = useState("");
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

  async function downloadAttachment(attachment: Attachment) {
    setError("");
    const response = await fetch(`/api/files/${attachment.fileId}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    if (!response.ok) {
      setError(mk ? "Преземањето не успеа." : "Download failed.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.originalFilename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAttachment(attachment: Attachment) {
    setError("");
    const response = await fetch(`/api/files/${attachment.fileId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    if (!response.ok) {
      setError(mk ? "Бришењето не успеа." : "Delete failed.");
      return;
    }
    setAttachments((items) => items.filter((item) => item.id !== attachment.id));
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
      {error && <p className="form-error">{error}</p>}
      {attachments.length > 0 && (
        <div className="contact-document-list">
          {attachments.map((file) => (
            <div key={file.id} className="contact-document-row">
              <span>{file.originalFilename}</span>
              <button
                type="button"
                className="secondary"
                onClick={() => setPreview(file)}
              >
                {mk ? "Прегледaj" : "Preview"}
              </button>
              <button
                type="button"
                onClick={() => void downloadAttachment(file)}
              >
                {mk ? "Преземи" : "Download"}
              </button>
              <button
                type="button"
                className="reject"
                onClick={() => void deleteAttachment(file)}
              >
                {mk ? "Отстрани" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <DocumentPreview document={preview} onClose={() => setPreview(undefined)} />
      )}
    </div>
  );
}
