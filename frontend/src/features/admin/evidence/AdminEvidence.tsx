import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  Evidence,
  EvidenceTarget,
  EvidenceTemplate,
} from "../../../pages/admin/adminModels";
import { evidenceTemplateView } from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";

type Resource<T> = { data: T[] | null; loading: boolean };
type View = "upload" | "templates" | "register";
type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  evidenceView: View;
  setEvidenceView: Dispatch<SetStateAction<View>>;
  evidenceEntityType: string;
  setEvidenceEntityType: Dispatch<SetStateAction<string>>;
  evidenceRelatedId: string;
  setEvidenceRelatedId: Dispatch<SetStateAction<string>>;
  showEvidenceTargets: boolean;
  setShowEvidenceTargets: Dispatch<SetStateAction<boolean>>;
  evidence: Resource<Evidence>;
  evidenceTemplates: Resource<EvidenceTemplate>;
  evidenceTargets: Resource<EvidenceTarget>;
  uploadEvidence: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  downloadEvidence: (fileId: string) => Promise<void>;
  downloadTemplate: (
    template: EvidenceTemplate,
    format: "xlsx" | "csv",
  ) => Promise<void>;
  onClearError: () => void;
};

export function AdminEvidence(props: Props) {
  const {
    t,
    language,
    evidenceView,
    setEvidenceView,
    evidenceEntityType,
    setEvidenceEntityType,
    evidenceRelatedId,
    setEvidenceRelatedId,
    showEvidenceTargets,
    setShowEvidenceTargets,
    evidence,
    evidenceTemplates,
    evidenceTargets,
    uploadEvidence,
    downloadEvidence,
    downloadTemplate,
    onClearError,
  } = props;
  return (
    <div className="workspace evidence-workspace evidence-center">
      <header className="evidence-center-header">
        <div>
          <span className="kicker">CRM SYSTEM · KPI</span>
          <h2>
            {language === "mk"
              ? "KPI документација"
              : language === "sq"
                ? "Dokumentacioni KPI"
                : "KPI documentation"}
          </h2>
          <p>
            {language === "mk"
              ? "Креирајте документ, преземете образец или прегледајте го регистарот — без долга страница со сите алатки одеднаш."
              : language === "sq"
                ? "Krijoni dokument, shkarkoni model ose shikoni regjistrin në një vend."
                : "Create a document, download a template or review the register in one place."}
          </p>
        </div>
        <div className="evidence-summary" aria-label="KPI summary">
          <b>{evidence.data?.length ?? 0}</b>
          <span>
            {language === "mk"
              ? "документи"
              : language === "sq"
                ? "dokumente"
                : "documents"}
          </span>
        </div>
      </header>
      <nav className="evidence-view-tabs" aria-label="KPI documentation views">
        {(
          [
            [
              "upload",
              language === "mk"
                ? "Нов документ"
                : language === "sq"
                  ? "Dokument i ri"
                  : "New document",
            ],
            [
              "templates",
              language === "mk"
                ? "Обрасци"
                : language === "sq"
                  ? "Modele"
                  : "Templates",
            ],
            [
              "register",
              language === "mk"
                ? "Регистар"
                : language === "sq"
                  ? "Regjistri"
                  : "Register",
            ],
          ] as const
        ).map(([view, label]) => (
          <button
            key={view}
            type="button"
            className={evidenceView === view ? "active" : ""}
            onClick={() => setEvidenceView(view)}
          >
            {label}
            {view === "templates" && (
              <small>{evidenceTemplates.data?.length ?? 0}</small>
            )}
            {view === "register" && <small>{evidence.data?.length ?? 0}</small>}
          </button>
        ))}
      </nav>
      <form
        className="workspace-form evidence-upload-form"
        onSubmit={uploadEvidence}
        hidden={evidenceView !== "upload"}
      >
        <h2>
          {language === "en"
            ? "New KPI document"
            : language === "sq"
              ? "Dokument i ri KPI"
              : "Нов KPI документ"}
        </h2>
        <label>
          {t.relatedType}
          <select
            name="relatedEntityType"
            required
            value={evidenceEntityType}
            onChange={(event) => {
              setEvidenceEntityType(event.target.value);
              setEvidenceRelatedId("");
              setShowEvidenceTargets(false);
              onClearError();
            }}
          >
            {[
              "Ticket",
              "Meeting",
              "Subscription",
              "ContactRequest",
              "KpiPeriod",
            ].map((type) => (
              <option key={type} value={type}>
                {labelFor(type, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.relatedId}
          <div className="evidence-id-control">
            <input
              name="relatedEntityId"
              required
              pattern="[0-9a-fA-F-]{36}"
              placeholder="UUID"
              value={evidenceRelatedId}
              onChange={(event) => setEvidenceRelatedId(event.target.value)}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => setShowEvidenceTargets((value) => !value)}
            >
              {language === "mk"
                ? "Види UUID"
                : language === "sq"
                  ? "Shih UUID"
                  : "View UUID"}
            </button>
          </div>
          {showEvidenceTargets && (
            <div className="evidence-target-picker">
              <small>
                {language === "mk"
                  ? "Изберете запис — UUID ќе се внесе автоматски."
                  : language === "sq"
                    ? "Zgjidhni regjistrin — UUID plotësohet automatikisht."
                    : "Select a record — its UUID will be filled automatically."}
              </small>
              {evidenceTargets.loading && <p>{t.loading}</p>}
              {(evidenceTargets.data ?? []).map((target) => (
                <button
                  type="button"
                  key={target.id}
                  onClick={() => {
                    setEvidenceRelatedId(target.id);
                    setShowEvidenceTargets(false);
                  }}
                >
                  <b>{target.label}</b>
                  <code>{target.id}</code>
                </button>
              ))}
              {!evidenceTargets.loading &&
                !(evidenceTargets.data ?? []).length && (
                  <p>
                    {language === "mk"
                      ? "Нема достапни записи."
                      : language === "sq"
                        ? "Nuk ka regjistra."
                        : "No records available."}
                  </p>
                )}
            </div>
          )}
        </label>
        <label>
          {t.kpiCategory}
          <input name="kpiCategory" />
        </label>
        <label>
          {t.period}
          <input name="reportingPeriod" placeholder="2026-Q3" />
        </label>
        <label>
          {t.template}
          <select name="templateId">
            <option value="">{t.selectTemplate}</option>
            {(evidenceTemplates.data ?? [])
              .filter(
                (item) =>
                  item.isActive &&
                  item.relatedEntityType === evidenceEntityType,
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {evidenceTemplateView(item, language).title}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t.file}
          <input
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.csv,.xlsx"
            required
          />
        </label>
        <button className="primary">
          {language === "en"
            ? "Upload document"
            : language === "sq"
              ? "Ngarko dokumentin"
              : "Прикачи документ"}{" "}
        </button>
      </form>
      <div
        className="evidence-template-panel"
        hidden={evidenceView !== "templates"}
      >
        <div className="evidence-section-heading">
          <span className="kicker">CRM SYSTEM · KPI</span>
          <h2>
            {language === "en"
              ? "KPI document templates"
              : language === "sq"
                ? "Modelet e dokumenteve KPI"
                : "Обрасци за KPI документација"}
          </h2>
          <p>
            {language === "mk"
              ? "Изберете готов Excel образец, пополнете ги означените полиња и прикачете го како KPI документација."
              : language === "sq"
                ? "Zgjidhni një model Excel, plotësoni fushat dhe ngarkojeni si dokumentacion KPI."
                : "Choose an Excel template, complete the marked fields and upload it as KPI documentation."}
          </p>
        </div>
        <div className="evidence-template-list">
          {(evidenceTemplates.data ?? []).map((item) => {
            const presentation = evidenceTemplateView(item, language);
            const fieldCount = (() => {
              try {
                return (JSON.parse(item.requiredMetadataJson) as string[])
                  .length;
              } catch {
                return 0;
              }
            })();
            return (
              <article className="evidence-template-card" key={item.id}>
                <div className="evidence-template-icon" aria-hidden="true">
                  XLSX
                </div>
                <div className="evidence-template-copy">
                  <span>{labelFor(item.relatedEntityType, language)}</span>
                  <h3>{presentation.title}</h3>
                  <p>{presentation.description}</p>
                  <small>
                    {fieldCount}{" "}
                    {language === "mk"
                      ? "полиња за пополнување"
                      : language === "sq"
                        ? "fusha për plotësim"
                        : "fields to complete"}
                  </small>
                </div>
                <div className="template-download-actions">
                  <button
                    type="button"
                    className="format-button format-button-primary"
                    onClick={() => void downloadTemplate(item, "xlsx")}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    className="format-button"
                    onClick={() => void downloadTemplate(item, "csv")}
                  >
                    CSV
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div
        className="evidence-register-panel"
        hidden={evidenceView !== "register"}
      >
        <h2 className="evidence-register-title">
          {language === "en"
            ? "KPI document register"
            : language === "sq"
              ? "Regjistri i dokumenteve KPI"
              : "Регистар на KPI документација"}
        </h2>
        {(evidence.data ?? []).map((item) => (
          <article className="meeting-card" key={item.id}>
            <span className="tag blue">{item.relatedEntityType}</span>
            <b>{item.kpiCategory ?? item.templateType ?? "Evidence"}</b>
            <p>{item.relatedEntityId}</p>
            <small>
              {item.reportingPeriod ?? "—"} ·{" "}
              {new Date(item.createdAt).toLocaleDateString()}
            </small>
            <button
              className="secondary"
              onClick={() => downloadEvidence(item.fileId)}
            >
              {t.download}
            </button>
          </article>
        ))}
        {!evidence.loading && !(evidence.data ?? []).length && (
          <p className="empty-state">
            {language === "mk"
              ? "Сè уште нема прикачени KPI документи."
              : language === "sq"
                ? "Ende nuk ka dokumente KPI të ngarkuara."
                : "No KPI documents have been uploaded yet."}
          </p>
        )}
      </div>
    </div>
  );
}
