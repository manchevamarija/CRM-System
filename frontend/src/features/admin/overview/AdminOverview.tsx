import type { Language } from "../../../shared/types";
import { labelFor } from "../../../shared/labels";
import type { Contact, Kpis } from "../../../pages/admin/adminModels";
import type { Tab } from "../../../pages/admin/AdminDashboardPage";
import type { workspaceCopy } from "../../../content/workspaceCopy";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  kpis: Kpis | null;
  contacts: Contact[];
  statusOrder: string[];
  statusCounts: Record<string, number>;
  activeClients: number;
  assignedAgents: number;
  totalValue: number;
  crmText: (mk: string, en: string, sq: string) => string;
  onTab: (tab: Tab) => void;
};

export function AdminOverview({
  t,
  language,
  kpis,
  contacts,
  statusOrder,
  statusCounts,
  activeClients,
  assignedAgents,
  totalValue,
  crmText,
  onTab,
}: Props) {
  return (
    <div className="admin-overview-dashboard">
      <div className="stats admin-primary-stats">
        <article>
          <span>{t.activeSubscriptions}</span>
          <b>{kpis?.activeSubscriptions ?? 0}</b>
          <small>
            {kpis?.expiredSubscriptions ?? 0} {t.expiredCancelled}
          </small>
        </article>
        <article>
          <span>{t.tickets}</span>
          <b>{kpis?.tickets ?? 0}</b>
        </article>
        <article>
          <span>{t.contactRequests}</span>
          <b>{kpis?.contactRequests ?? 0}</b>
          <small>
            {kpis?.publicInstitutions ?? 0} {t.publicInstitutions}
          </small>
        </article>
      </div>
      <section className="crm-statistics-panel">
        <div className="list-head">
          <div>
            <h2>
              {crmText(
                "Статус на клиентите",
                "Client pipeline",
                "Statusi i klientëve",
              )}
            </h2>
            <p>
              {crmText(
                "Преглед во реално време на сите клиентски барања.",
                "Real-time overview of all client requests.",
                "Pasqyrë në kohë reale e të gjitha kërkesave të klientëve.",
              )}
            </p>
          </div>
          <button className="secondary" onClick={() => onTab("contacts")}>
            {crmText("Отвори клиенти", "Open clients", "Hap klientët")} →
          </button>
        </div>
        <div className="crm-pipeline-stats">
          {statusOrder.map((status, index) => (
            <article key={status}>
              <div>
                <i className="pipeline-index">
                  {String(index + 1).padStart(2, "0")}
                </i>
                <span>{labelFor(status, language)}</span>
              </div>
              <b>{statusCounts[status] ?? 0}</b>
              <small>
                {contacts.length
                  ? `${Math.round(((statusCounts[status] ?? 0) / contacts.length) * 100)}%`
                  : "0%"}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section className="admin-business-stats">
        <article>
          <span>
            {crmText(
              "Активни CRM клиенти",
              "Active CRM clients",
              "Klientë aktivë CRM",
            )}
          </span>
          <b>{activeClients}</b>
          <small>
            {crmText(
              "Во тек на обработка",
              "Currently being processed",
              "Në përpunim",
            )}
          </small>
        </article>
        <article>
          <span>
            {crmText(
              "Ангажирани агенти",
              "Assigned agents",
              "Agjentë të angazhuar",
            )}
          </span>
          <b>{assignedAgents}</b>
          <small>
            {crmText(
              "Со доделени клиенти",
              "With assigned clients",
              "Me klientë të caktuar",
            )}
          </small>
        </article>
        <article>
          <span>
            {crmText(
              "Вредност на услуги",
              "Service value",
              "Vlera e shërbimeve",
            )}
          </span>
          <b>
            {totalValue.toLocaleString(language === "mk" ? "mk-MK" : language)}{" "}
            €
          </b>
          <small>
            {crmText(
              "Внесени понуди",
              "Recorded offers",
              "Oferta të regjistruara",
            )}
          </small>
        </article>
        <article>
          <span>
            {crmText(
              "Услужени клиенти",
              "Served clients",
              "Klientë të shërbyer",
            )}
          </span>
          <b>{statusCounts.Served ?? 0}</b>
          <small>
            {crmText(
              "Завршен CRM процес",
              "Completed CRM process",
              "Proces CRM i përfunduar",
            )}
          </small>
        </article>
      </section>
    </div>
  );
}
