import { labelFor } from "../../shared/labels";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import type { CrmRequest, CrmServiceItem } from "./clientModels";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import { crmServiceCatalog, serviceLabel } from "../../shared/serviceCatalog";

const crmStatuses = [
  "Applied",
  "Contacting",
  "Assigned",
  "ServicesConfirmed",
  "InService",
  "FollowUp",
  "Served",
];

type Props = {
  requests: CrmRequest[];
  loading: boolean;
};

export function ClientCrmPanel({ requests, loading }: Props) {
  const language = usePortalLanguage();
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const locale = language === "mk" ? "mk-MK" : language;

  if (loading) {
    return (
      <div className="empty-panel">
        {text(
          "Се вчитува CRM профилот…",
          "Loading your CRM profile…",
          "Duke ngarkuar profilin CRM…",
        )}
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="empty-panel">
        <h2>
          {text(
            "Сè уште немате CRM барање",
            "You do not have a CRM request yet",
            "Ende nuk keni kërkesë CRM",
          )}
        </h2>
        <p>
          {text(
            "Испратете барање со истата е-пошта и автоматски ќе се појави овде.",
            "Submit a request with the same email and it will appear here automatically.",
            "Dërgoni kërkesë me të njëjtin email dhe do të shfaqet automatikisht këtu.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="client-crm-list">
      {requests.map((request) => (
        <CrmRequestCard
          key={request.id}
          request={request}
          locale={locale}
          language={language}
          text={text}
        />
      ))}
    </div>
  );
}

type CardProps = {
  request: CrmRequest;
  locale: string;
  language: "mk" | "en" | "sq";
  text: (mk: string, en: string, sq: string) => string;
};

function CrmRequestCard({ request, locale, language, text }: CardProps) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const services = parseServices(request.serviceItemsJson);
  const currentStatus = crmStatuses.indexOf(request.status);
  const requestType =
    request.requestType === "Partnership"
      ? text("Соработка", "Partnership", "Bashkëpunim")
      : text("Консултација", "Consultation", "Konsultim");

  return (
    <article className="client-crm-card">
      <header>
        <div>
          <span className="kicker">
            CRM · DM-{request.id.slice(0, 8).toUpperCase()}
          </span>
          <h2>{request.organizationName}</h2>
          <small>
            {requestType} · {text("Поднесено", "Submitted", "Dërguar")}{" "}
            {new Date(request.createdAt).toLocaleDateString(locale)}
          </small>
        </div>
        <span className="tag green">{labelFor(request.status, language)}</span>
      </header>

      <div className="crm-timeline client-timeline">
        {crmStatuses.map((status, index) => (
          <div className={index <= currentStatus ? "active" : ""} key={status}>
            <i>{index < currentStatus ? "✓" : index + 1}</i>
            <span>{labelFor(status, language)}</span>
          </div>
        ))}
      </div>

      <section className="client-services">
        <div className="list-head">
          <h3>
            {text(
              "Избрани услуги",
              "Selected services",
              "Shërbimet e zgjedhura",
            )}
          </h3>
          <span>{services.length}</span>
        </div>
        {services.map((service) => (
          <div className="client-service-row" key={service.id}>
            <div>
              <b>{service.name}</b>
              <small>{labelFor(service.status, language)}</small>
            </div>
            <span>
              {service.price != null
                ? `${service.price.toLocaleString(locale)} €`
                : text(
                    "Цена по понуда",
                    "Price on request",
                    "Çmimi sipas ofertës",
                  )}
            </span>
            <span>
              {service.deadline
                ? `${text("Рок", "Deadline", "Afati")}: ${new Date(service.deadline).toLocaleDateString(locale)}`
                : text(
                    "Рокот се договара",
                    "Deadline to be agreed",
                    "Afati sipas marrëveshjes",
                  )}
            </span>
          </div>
        ))}
      </section>
      <form
        className="crm-add-service"
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setError("");
          setAdding(true);
          const form = event.currentTarget;
          const name = String(new FormData(form).get("name") ?? "").trim();
          try {
            await api(`/api/crm/my-requests/${request.id}/services`, {
              method: "POST",
              body: JSON.stringify({ name }),
            });
            form.reset();
            window.dispatchEvent(new Event("crm:refresh"));
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : text(
                    "Услугата не можеше да се додаде.",
                    "The service could not be added.",
                    "Shërbimi nuk mund të shtohej.",
                  ),
            );
          } finally {
            setAdding(false);
          }
        }}
      >
        <div>
          <b>
            {text(
              "Додади нова услуга",
              "Add a new service",
              "Shto shërbim të ri",
            )}
          </b>
          <small>
            {text(
              "Барањето останува исто, а администраторот веднаш ќе биде известен.",
              "The request remains the same and the administrator is notified immediately.",
              "Kërkesa mbetet e njëjtë dhe administratori njoftohet menjëherë.",
            )}
          </small>
        </div>
        <select name="name" required defaultValue="">
          <option value="" disabled>
            {text("Изберете услуга", "Select a service", "Zgjidhni shërbimin")}
          </option>
          {crmServiceCatalog
            .filter(
              (option) =>
                !services.some((service) => service.name === option.value),
            )
            .map((option) => (
              <option key={option.value} value={option.value}>
                {serviceLabel(option, language)}
              </option>
            ))}
        </select>
        <button className="primary" disabled={adding}>
          {adding ? "…" : text("Додади услуга", "Add service", "Shto shërbim")}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>

      <p className="crm-live-note">
        <span />{" "}
        {text(
          "Овој преглед се ажурира автоматски кога CRM System ќе направи промена.",
          "This view updates automatically when CRM System makes a change.",
          "Ky pasqyrim përditësohet automatikisht kur CRM System bën një ndryshim.",
        )}
      </p>
    </article>
  );
}

function parseServices(json: string): CrmServiceItem[] {
  try {
    return JSON.parse(json || "[]") as CrmServiceItem[];
  } catch {
    return [];
  }
}
