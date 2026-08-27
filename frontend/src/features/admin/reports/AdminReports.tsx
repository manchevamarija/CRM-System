import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  ContactReport,
  Kpis,
  MeetingReport,
  TicketReport,
  CountGroup,
  CrmDemandReport,
  CrmAnalyticsReport,
  User,
} from "../../../pages/admin/adminModels";
import { ReportSection } from "../../../pages/admin/AdminSharedComponents";

type Copy = ReturnType<typeof workspaceCopy>;

type Props = {
  t: Copy;
  language: Language;
  kpis?: Kpis | null;
  contacts?: ContactReport | null;
  tickets?: TicketReport | null;
  meetings?: MeetingReport | null;
  referrals?: CountGroup[] | null;
  crmDemand?: CrmDemandReport | null;
  analytics?: CrmAnalyticsReport | null;
  users: User[];
  onExport: (dataset: string, format: "xlsx" | "csv" | "json") => Promise<void>;
};

export function AdminReports({
  t,
  language,
  kpis,
  contacts,
  tickets,
  meetings,
  referrals,
  crmDemand,
  analytics,
  users,
  onExport,
}: Props) {
  const ticketGroups: Record<string, CountGroup[]> = tickets
    ? {
        category: tickets.byCategory,
        status: tickets.byStatus,
        assignee: tickets.byAssignee.map((group) => ({
          ...group,
          key: users.find((user) => user.id === group.key)?.email ?? group.key,
        })),
        organizationType: tickets.byOrganizationType,
      }
    : {};

  return (
    <>
      <section className="report-block report-overview-block">
        <div className="report-block-heading">
          <span>01</span>
          <div>
            <h2>
              {language === "mk"
                ? "Краток преглед"
                : language === "sq"
                  ? "Pasqyrë e shkurtër"
                  : "At a glance"}
            </h2>
            <p>
              {language === "mk"
                ? "Најважните активности во CRM системот."
                : language === "sq"
                  ? "Aktivitetet kryesore në sistemin CRM."
                  : "Key activity across the CRM system."}
            </p>
          </div>
        </div>
        <div className="stats report-overview-grid">
          <article>
            <span>{t.aiHelpSubscriptions}</span>
            <b>{kpis?.aiHelpDeskSubscriptions ?? 0}</b>
          </article>
          <article>
            <span>{t.confirmedMeetings}</span>
            <b>{kpis?.confirmedMeetings ?? 0}</b>
          </article>
          <article>
            <span>{t.referrals}</span>
            <b>{kpis?.referrals ?? 0}</b>
          </article>
          <article>
            <span>
              {language === "mk"
                ? "Клиенти со повеќе барања"
                : language === "sq"
                  ? "Klientë me disa kërkesa"
                  : "Repeat clients"}
            </span>
            <b>{kpis?.repeatClients ?? 0}</b>
          </article>
        </div>
      </section>

      <section className="report-block report-value-block">
        <div className="report-block-heading">
          <span>02</span>
          <div>
            <h2>
              {language === "mk"
                ? "Услуги и вредност"
                : language === "sq"
                  ? "Shërbimet dhe vlera"
                  : "Services and value"}
            </h2>
            <p>
              {language === "mk"
                ? "Финансиски показатели, реализација и претстојни рокови."
                : language === "sq"
                  ? "Treguesit financiarë, realizimi dhe afatet."
                  : "Financial indicators, delivery and upcoming deadlines."}
            </p>
          </div>
        </div>
        <div className="report-metric-grid">
          <article>
            <span>
              {language === "mk"
                ? "Вкупна понудена вредност"
                : "Total quoted value"}
            </span>
            <b>{(analytics?.totalQuotedValue ?? 0).toLocaleString()} €</b>
          </article>
          <article>
            <span>
              {language === "mk"
                ? "Просечна вредност на услуга"
                : "Average service value"}
            </span>
            <b>
              {(analytics?.averageServiceValue ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{" "}
              €
            </b>
          </article>
          <article>
            <span>
              {language === "mk"
                ? "Стапка на услужени барања"
                : "Request conversion rate"}
            </span>
            <b>{analytics?.conversionRate ?? 0}%</b>
          </article>
          <article>
            <span>
              {language === "mk"
                ? "Завршени услуги"
                : "Service completion rate"}
            </span>
            <b>{analytics?.completionRate ?? 0}%</b>
          </article>
          <article
            className={
              (analytics?.overdueServices ?? 0) > 0 ? "metric-alert" : ""
            }
          >
            <span>
              {language === "mk" ? "Услуги со поминат рок" : "Overdue services"}
            </span>
            <b>{analytics?.overdueServices ?? 0}</b>
          </article>
          <article>
            <span>
              {language === "mk"
                ? "Рокови во следни 30 дена"
                : "Due in next 30 days"}
            </span>
            <b>{analytics?.upcomingDeadlines ?? 0}</b>
          </article>
        </div>
      </section>

      <section className="report-block report-chart-block">
        <div className="report-block-heading">
          <span>03</span>
          <div>
            <h2>
              {language === "mk"
                ? "Графички преглед"
                : language === "sq"
                  ? "Pasqyrë grafike"
                  : "Visual overview"}
            </h2>
            <p>
              {language === "mk"
                ? "Распределба и движење на барањата низ времето."
                : language === "sq"
                  ? "Shpërndarja dhe lëvizja e kërkesave me kalimin e kohës."
                  : "Distribution and movement of requests over time."}
            </p>
          </div>
        </div>
        <div className="analytics-chart-grid">
          <DonutChart
            title={
              language === "mk"
                ? "Распределба на CRM барања"
                : language === "sq"
                  ? "Shpërndarja e kërkesave CRM"
                  : "CRM request distribution"
            }
            rows={analytics?.byCrmStage ?? []}
            language={language}
          />
          <TrendChart
            title={
              language === "mk"
                ? "Движење на нови барања"
                : language === "sq"
                  ? "Trendi i kërkesave të reja"
                  : "New request trend"
            }
            rows={analytics?.byMonth ?? []}
            language={language}
          />
          <DonutChart
            title={
              language === "mk"
                ? "Испорака на услуги"
                : language === "sq"
                  ? "Ofrimi i shërbimeve"
                  : "Service delivery"
            }
            rows={analytics?.byServiceStatus ?? []}
            language={language}
          />
        </div>
      </section>

      <div className="workspace">
        <h2>{t.detailedReports}</h2>
        <div className="calendar-grid">
          <ReportSection
            title={t.contactsBreakdown}
            groups={
              contacts
                ? {
                    organizationType: contacts.byOrganizationType,
                    sector: contacts.bySector,
                    region: contacts.byRegion,
                    need: contacts.byNeed,
                    dmaCategory: contacts.byDmaCategory,
                  }
                : {}
            }
            language={language}
          />
          <ReportSection
            title={
              language === "mk" ? "Најбарани услуги" : "Most requested services"
            }
            groups={{ service: crmDemand?.byService ?? [] }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk" ? "Најактивни клиенти" : "Most active clients"
            }
            groups={{ client: crmDemand?.byClient ?? [] }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk" ? "CRM funnel по фаза" : "CRM funnel by stage"
            }
            groups={{ status: analytics?.byCrmStage ?? [] }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk"
                ? "Нови барања по месец"
                : "New requests by month"
            }
            groups={{ month: analytics?.byMonth ?? [] }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk"
                ? "Статус на услугите"
                : "Service delivery status"
            }
            groups={{ status: analytics?.byServiceStatus ?? [] }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk"
                ? "Работно оптоварување по агент"
                : "Agent workload"
            }
            groups={{
              assignee: (analytics?.byAgent ?? []).map((group) => ({
                ...group,
                key:
                  users.find((user) => user.id === group.key)?.email ??
                  group.key,
              })),
            }}
            language={language}
          />
          <ReportSection
            title={
              language === "mk"
                ? "Тип и буџет на барањата"
                : "Request type and budget"
            }
            groups={{
              requestType: analytics?.byRequestType ?? [],
              budget: analytics?.byBudget ?? [],
            }}
            language={language}
          />
          <ReportSection
            title={t.ticketsBreakdown}
            groups={ticketGroups}
            language={language}
          />
          <ReportSection
            title={t.meetingsBreakdown}
            groups={
              meetings
                ? { status: meetings.byStatus, type: meetings.byType }
                : {}
            }
            language={language}
          />
          <ReportSection
            title={t.referralsBreakdown}
            groups={{ recommendation: referrals ?? [] }}
            language={language}
          />
        </div>
      </div>

      <div className="kpi-card report-export-card">
        <h2>{t.exportData}</h2>
        <div className="report-export-grid">
          {[
            "tickets",
            "contacts",
            "meetings",
            "subscriptions",
            "crm-demand",
            "crm-analytics",
          ].map((dataset) => (
            <section className="report-export-item" key={dataset}>
              <b>{labelFor(dataset, language)}</b>
              <div className="action-row">
                <button onClick={() => void onExport(dataset, "xlsx")}>
                  {t.downloadExcel}
                </button>
                <button onClick={() => void onExport(dataset, "csv")}>
                  {t.downloadCsv}
                </button>
                <button onClick={() => void onExport(dataset, "json")}>
                  {language === "mk"
                    ? "Преземи JSON"
                    : language === "sq"
                      ? "Shkarko JSON"
                      : "Download JSON"}
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

function DonutChart({
  title,
  rows,
  language,
}: {
  title: string;
  rows: CountGroup[];
  language: Language;
}) {
  const palette = [
    "#173f5f",
    "#267a82",
    "#c58b2a",
    "#6c8290",
    "#87a6a8",
    "#b8c7ca",
    "#324f60",
  ];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let cursor = 0;
  const gradient = total
    ? `conic-gradient(${rows
        .map((row, index) => {
          const start = cursor;
          cursor += (row.count / total) * 100;
          return `${palette[index % palette.length]} ${start}% ${cursor}%`;
        })
        .join(",")})`
    : "conic-gradient(#e5ebed 0 100%)";
  return (
    <article className="analytics-chart">
      <header>
        <span>CRM ANALYTICS</span>
        <h3>{title}</h3>
      </header>
      <div className="donut-layout">
        <div className="donut" style={{ background: gradient }}>
          <div>
            <b>{total}</b>
            <small>
              {language === "mk"
                ? "вкупно"
                : language === "sq"
                  ? "gjithsej"
                  : "total"}
            </small>
          </div>
        </div>
        <div className="chart-legend">
          {rows.length ? (
            rows.map((row, index) => (
              <div key={row.key}>
                <i style={{ background: palette[index % palette.length] }} />
                <span>{labelFor(row.key, language)}</span>
                <b>{row.count}</b>
              </div>
            ))
          ) : (
            <p>
              {language === "mk"
                ? "Графиконот ќе се пополни со првите податоци."
                : language === "sq"
                  ? "Grafiku do të plotësohet me të dhënat e para."
                  : "The chart will populate with the first data."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function TrendChart({
  title,
  rows,
  language,
}: {
  title: string;
  rows: CountGroup[];
  language: Language;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const data = rows.length ? rows : [{ key: "—", count: 0 }];
  return (
    <article className="analytics-chart">
      <header>
        <span>CRM TREND</span>
        <h3>{title}</h3>
      </header>
      <div className="trend-chart">
        {data.map((row) => (
          <div key={row.key}>
            <b>{row.count}</b>
            <i>
              <span
                style={{ height: `${Math.max(5, (row.count / max) * 100)}%` }}
              />
            </i>
            <small>{row.key}</small>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p className="chart-empty">
          {language === "mk"
            ? "Месечниот тренд ќе се прикаже по внесување барања."
            : language === "sq"
              ? "Trendi mujor do të shfaqet pas kërkesave të para."
              : "Monthly trend will appear after requests are added."}
        </p>
      )}
    </article>
  );
}
