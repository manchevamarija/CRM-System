import { getAccessToken } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { AdminAttachment, EvidenceTemplate } from "../adminModels";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  setError: (message: string) => void;
};

export function useAdminDownloads({ t, setError }: Props) {
  const exportReport = async (
    dataset = "tickets",
    format: "xlsx" | "csv" | "json" = "xlsx",
  ) => {
    const query = format === "xlsx" ? "" : `?format=${format}`;
    await download(
      `/api/admin/reports/export/${dataset}${query}`,
      `crm-system-${dataset}.${format}`,
      t.reportDownloadError,
    );
  };

  const downloadEvidence = async (fileId: string) => {
    await download(
      `/api/files/${fileId}`,
      "crm-system-evidence",
      t.evidenceDownloadError,
      true,
    );
  };

  const downloadAttachment = async (attachment: AdminAttachment) => {
    await download(
      `/api/files/${attachment.fileId}`,
      attachment.originalFilename,
      t.attachmentDownloadError,
      true,
    );
  };

  const downloadTemplate = async (
    template: EvidenceTemplate,
    format: "xlsx" | "csv",
  ) => {
    const query = format === "csv" ? "?format=csv" : "";
    await download(
      `/api/admin/evidence-templates/${template.id}/blank${query}`,
      `${template.code}-template.${format}`,
      t.reportDownloadError,
    );
  };

  const download = async (
    url: string,
    fallbackName: string,
    errorMessage: string,
    credentials = false,
  ) => {
    const response = await fetch(url, {
      credentials: credentials ? "include" : undefined,
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    if (!response.ok) return setError(errorMessage);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      response.headers
        .get("content-disposition")
        ?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  return {
    exportReport,
    downloadEvidence,
    downloadAttachment,
    downloadTemplate,
  };
}
