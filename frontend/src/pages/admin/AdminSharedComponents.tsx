import { useState } from "react";
import type { FormEvent } from "react";
import type { Language } from "../../shared/types";
import { labelFor } from "../../shared/labels";
import type { ContentCollection, CountGroup } from "./adminModels";

export function ContentForm({
  title,
  onSubmit,
  language,
  category = false,
}: {
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  language: Language;
  category?: boolean;
}) {
  const [contentTitle, setContentTitle] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [validationError, setValidationError] = useState("");
  const editorCopy = {
    mk: {
      slug: "URL ознака",
      status: "Статус",
      category: "Категорија",
      content: "Содржина",
      title: "Наслов",
      description: "Опис",
      save: "Зачувај",
      required: "Внесете наслов и опис.",
      shared:
        "Истата содржина автоматски ќе се прикаже на македонски, англиски и албански.",
    },
    en: {
      slug: "URL slug",
      status: "Status",
      category: "Category",
      content: "Content",
      title: "Title",
      description: "Description",
      save: "Save",
      required: "Enter a title and description.",
      shared:
        "The same content will automatically be shown in Macedonian, English and Albanian.",
    },
    sq: {
      slug: "Shenja e URL-së",
      status: "Statusi",
      category: "Kategoria",
      content: "Përmbajtja",
      title: "Titulli",
      description: "Përshkrimi",
      save: "Ruaj",
      required: "Vendosni titullin dhe përshkrimin.",
      shared:
        "E njëjta përmbajtje do të shfaqet automatikisht në maqedonisht, anglisht dhe shqip.",
    },
  }[language];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!contentTitle.trim() || !contentDescription.trim()) {
      setValidationError(editorCopy.required);
      return;
    }
    setValidationError("");
    const saved = await onSubmit(event);
    if (!saved) return;
    form.reset();
    setContentTitle("");
    setContentDescription("");
  };

  return (
    <form className="workspace-form" onSubmit={submit}>
      <h2>{title}</h2>
      <label>
        {editorCopy.slug}
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="digital-roadmap"
        />
      </label>
      <label>
        {editorCopy.status}
        <select name="status" defaultValue="Published">
          {["Published", "Draft", "Archived"].map((status) => (
            <option key={status} value={status}>
              {labelFor(status, language)}
            </option>
          ))}
        </select>
      </label>
      {category && (
        <label>
          {editorCopy.category}
          <input name="category" defaultValue="General" required />
        </label>
      )}
      <fieldset className="content-localization-editor">
        <legend>{editorCopy.content}</legend>
        <p className="muted">{editorCopy.shared}</p>
        <label>
          {editorCopy.title}
          <input
            name="contentTitle"
            value={contentTitle}
            onChange={(event) => {
              setContentTitle(event.target.value);
              setValidationError("");
            }}
          />
        </label>
        <label>
          {editorCopy.description}
          <textarea
            name="contentDescription"
            rows={3}
            value={contentDescription}
            onChange={(event) => {
              setContentDescription(event.target.value);
              setValidationError("");
            }}
          />
        </label>
      </fieldset>
      {validationError && <p className="form-error">{validationError}</p>}
      <button className="primary">{editorCopy.save}</button>
    </form>
  );
}

export function ContentInventory({
  title,
  collection,
  loading,
  error,
  language,
}: {
  title: string;
  collection: ContentCollection | null;
  loading: boolean;
  error: string;
  language: Language;
}) {
  const translation = (
    entityId: string,
    locale: "mk" | "en" | "sq",
    fieldName: string,
  ) =>
    collection?.translations.find(
      (item) =>
        item.entityId === entityId &&
        item.language === locale &&
        item.fieldName === fieldName,
    )?.value ?? "";
  const emptyLabel =
    language === "mk"
      ? "Нема зачувана содржина."
      : language === "sq"
        ? "Nuk ka përmbajtje të ruajtur."
        : "No saved content.";
  return (
    <section className="content-inventory">
      <div className="list-head">
        <h2>{title}</h2>
        <small>
          {collection?.items.length ?? 0}{" "}
          {language === "mk"
            ? "ставки"
            : language === "sq"
              ? "artikuj"
              : "items"}
        </small>
      </div>
      {loading && <p>{language === "mk" ? "Се вчитува…" : "Loading…"}</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !collection?.items.length && <p>{emptyLabel}</p>}
      <div className="content-inventory-grid">
        {(collection?.items ?? []).map((item) => (
          <article className="content-inventory-card" key={item.id}>
            <div className="content-inventory-head">
              <div>
                <b>{translation(item.id, language, "title") || item.slug}</b>
                <small>/{item.slug}</small>
              </div>
              <span
                className={`tag ${item.status === "Published" ? "green" : "blue"}`}
              >
                {labelFor(item.status, language)}
              </span>
            </div>
            {item.category && <small>{item.category}</small>}
            {translation(item.id, language, "description") && (
              <p>{translation(item.id, language, "description")}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReportSection({
  title,
  groups,
  language,
}: {
  title: string;
  groups: Record<string, CountGroup[]>;
  language: Language;
}) {
  const labels: Record<Language, Record<string, string>> = {
    mk: {
      organizationType: "Тип на организација",
      sector: "Сектор",
      region: "Регион",
      need: "Потреба",
      dmaCategory: "DMA категорија",
      service: "Услуга",
      client: "Клиент",
      status: "Статус",
      month: "Месец",
      assignee: "Одговорно лице",
      requestType: "Тип на барање",
      budget: "Буџет",
      category: "Категорија",
      type: "Тип",
      recommendation: "Препорака",
    },
    en: {
      organizationType: "Organisation type",
      sector: "Sector",
      region: "Region",
      need: "Need",
      dmaCategory: "DMA category",
      service: "Service",
      client: "Client",
      status: "Status",
      month: "Month",
      assignee: "Assignee",
      requestType: "Request type",
      budget: "Budget",
      category: "Category",
      type: "Type",
      recommendation: "Recommendation",
    },
    sq: {
      organizationType: "Lloji i organizatës",
      sector: "Sektori",
      region: "Rajoni",
      need: "Nevoja",
      dmaCategory: "Kategoria DMA",
      service: "Shërbimi",
      client: "Klienti",
      status: "Statusi",
      month: "Muaji",
      assignee: "Përgjegjësi",
      requestType: "Lloji i kërkesës",
      budget: "Buxheti",
      category: "Kategoria",
      type: "Lloji",
      recommendation: "Rekomandimi",
    },
  };
  return (
    <article className="meeting-card">
      <h3>{title}</h3>
      {Object.entries(groups).map(([name, rows]) => (
        <div key={name}>
          <b className="report-group-title">
            {labels[language][name] ?? labelFor(name, language)}
          </b>
          {rows.length === 0 ? (
            <div className="report-empty">
              <i />
              <span>
                {language === "mk"
                  ? "Нема податоци за избраниот период"
                  : language === "sq"
                    ? "Nuk ka të dhëna për periudhën"
                    : "No data for the selected period"}
              </span>
            </div>
          ) : (
            <div className="report-bars">
              {rows.map((row) => {
                const max = Math.max(...rows.map((item) => item.count), 1);
                return (
                  <div className="report-bar" key={`${name}-${row.key}`}>
                    <div>
                      <span>{labelFor(row.key, language)}</span>
                      <strong>{row.count}</strong>
                    </div>
                    <i>
                      <span
                        style={{
                          width: `${Math.max(4, (row.count / max) * 100)}%`,
                        }}
                      />
                    </i>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </article>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value === undefined || value === null || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
