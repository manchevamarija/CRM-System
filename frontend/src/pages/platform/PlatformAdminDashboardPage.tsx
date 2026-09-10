import { useState } from "react";
import { useAuth } from "../../features/auth/useAuth";
import { labelFor } from "../../shared/labels";
import type { Language, Navigate } from "../../shared/types";
import { useApiResource } from "../../shared/useApiResource";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import type {
  PlatformOverview,
  PlatformTenant,
  PlatformUser,
} from "../admin/adminModels";

type Tab = "overview" | "tenants" | "users";

const copy = {
  mk: {
    title: "Platform Admin",
    eyebrow: "Глобална администрација",
    overview: "Преглед",
    tenants: "Центри",
    users: "Корисници",
    noAccess: "Немате пристап до platform admin.",
    back: "Назад",
    logout: "Одјави се",
    loading: "Се вчитува...",
    totals: {
      organizations: "Организации",
      contactRequests: "Контакт барања",
      tickets: "Тикети",
      meetings: "Состаноци",
      activeSubscriptions: "Активни претплати",
      users: "Корисници",
      platformAdmins: "Platform администратори",
      completedContactRequests: "Услужени CRM",
      averageDaysToServe: "Прос. денови",
      totalServiceValue: "Вредност на услуги",
      overdueServices: "Пробиени рокови",
    },
    tenantColumns: {
      centre: "Центар",
      organizations: "Орг.",
      contacts: "Контакти",
      tickets: "Тикети",
      meetings: "Состаноци",
      subscriptions: "Претплати",
      staff: "Тим",
      completed: "Услужени",
      avgDays: "Прос. денови",
      value: "Вредност",
      overdue: "Рокови",
    },
    userColumns: {
      user: "Корисник",
      status: "Статус",
      roles: "Улоги",
      memberships: "Центри",
      lastLogin: "Последна најава",
    },
    empty: {
      tenants: "Нема внесени центри за приказ.",
      users: "Нема корисници за приказ.",
    },
  },
  en: {
    title: "Platform Admin",
    eyebrow: "Global administration",
    overview: "Overview",
    tenants: "Centres",
    users: "Users",
    noAccess: "You do not have platform admin access.",
    back: "Back",
    logout: "Log out",
    loading: "Loading...",
    totals: {
      organizations: "Organisations",
      contactRequests: "Contact requests",
      tickets: "Tickets",
      meetings: "Meetings",
      activeSubscriptions: "Active subscriptions",
      users: "Users",
      platformAdmins: "Platform admins",
      completedContactRequests: "Served CRM",
      averageDaysToServe: "Avg. days",
      totalServiceValue: "Service value",
      overdueServices: "Overdue services",
    },
    tenantColumns: {
      centre: "Centre",
      organizations: "Org.",
      contacts: "Contacts",
      tickets: "Tickets",
      meetings: "Meetings",
      subscriptions: "Subscriptions",
      staff: "Staff",
      completed: "Served",
      avgDays: "Avg. days",
      value: "Value",
      overdue: "Overdue",
    },
    userColumns: {
      user: "User",
      status: "Status",
      roles: "Roles",
      memberships: "Centres",
      lastLogin: "Last login",
    },
    empty: {
      tenants: "There are no centres to show.",
      users: "There are no users to show.",
    },
  },
  sq: {
    title: "Platform Admin",
    eyebrow: "Administrim global",
    overview: "Përmbledhje",
    tenants: "Qendra",
    users: "Përdorues",
    noAccess: "Nuk keni qasje në platform admin.",
    back: "Prapa",
    logout: "Dil",
    loading: "Po ngarkohet...",
    totals: {
      organizations: "Organizata",
      contactRequests: "Kërkesa kontakti",
      tickets: "Tiketa",
      meetings: "Takime",
      activeSubscriptions: "Abonime aktive",
      users: "Përdorues",
      platformAdmins: "Administratorë platforme",
      completedContactRequests: "CRM të shërbyera",
      averageDaysToServe: "Ditë mes.",
      totalServiceValue: "Vlera e shërbimeve",
      overdueServices: "Afate të vonuara",
    },
    tenantColumns: {
      centre: "Qendra",
      organizations: "Org.",
      contacts: "Kontakte",
      tickets: "Tiketa",
      meetings: "Takime",
      subscriptions: "Abonime",
      staff: "Ekipi",
      completed: "Të shërbyera",
      avgDays: "Ditë mes.",
      value: "Vlera",
      overdue: "Afate",
    },
    userColumns: {
      user: "Përdorues",
      status: "Statusi",
      roles: "Role",
      memberships: "Qendra",
      lastLogin: "Hyrja e fundit",
    },
    empty: {
      tenants: "Nuk ka qendra për t'u shfaqur.",
      users: "Nuk ka përdorues për t'u shfaqur.",
    },
  },
};

export function PlatformAdminDashboardPage({
  onNavigate,
}: {
  onNavigate: Navigate;
}) {
  const language = usePortalLanguage();
  const text = copy[language];
  const { user, logout } = useAuth();
  const allowed = !!user?.roles.includes("PlatformAdmin");
  const [tab, setTab] = useState<Tab>("overview");
  const overview = useApiResource<PlatformOverview>(
    "/api/platform-admin/overview",
    allowed,
  );
  const users = useApiResource<PlatformUser[]>(
    "/api/platform-admin/users",
    allowed && tab === "users",
  );

  if (user && !allowed)
    return (
      <section className="page">
        <h1>{text.noAccess}</h1>
        <button className="secondary" onClick={() => onNavigate("dashboard")}>
          {text.back}
        </button>
      </section>
    );

  return (
    <section className="dashboard admin platform-admin">
      <aside>
        <div className="user">
          <span>PA</span>
          <div>
            <b>{user?.email ?? text.title}</b>
            <small>{text.eyebrow}</small>
          </div>
        </div>
        <button
          className="logout"
          onClick={async () => {
            await logout();
            onNavigate("home");
          }}
        >
          {text.logout}
        </button>
        <button
          className={tab === "overview" ? "sel" : ""}
          onClick={() => setTab("overview")}
        >
          <span>{text.overview}</span>
          <span>›</span>
        </button>
        <button
          className={tab === "tenants" ? "sel" : ""}
          onClick={() => setTab("tenants")}
        >
          <span>{text.tenants}</span>
          <span>›</span>
        </button>
        <button
          className={tab === "users" ? "sel" : ""}
          onClick={() => setTab("users")}
        >
          <span>{text.users}</span>
          <span>›</span>
        </button>
        <button onClick={() => onNavigate("admin")}>Admin ›</button>
      </aside>
      <div className="dash-main">
        <div className="dash-head">
          <div>
            <span>{text.eyebrow}</span>
            <h1>
              {tab === "overview"
                ? text.overview
                : tab === "tenants"
                  ? text.tenants
                  : text.users}
            </h1>
          </div>
        </div>
        {overview.error && (
          <p className="form-error dashboard-feedback">{overview.error}</p>
        )}
        {overview.loading && <p>{text.loading}</p>}
        {overview.data && (
          <>
            {tab === "overview" && (
              <PlatformTotalsGrid
                overview={overview.data}
                labels={text.totals}
              />
            )}
            {tab === "tenants" && (
              <TenantTable
                tenants={overview.data.tenants}
                labels={text.tenantColumns}
                emptyText={text.empty.tenants}
              />
            )}
            {tab === "users" && (
              <UsersTable
                users={users.data ?? []}
                loading={users.loading}
                error={users.error}
                labels={text.userColumns}
                language={language}
                loadingText={text.loading}
                emptyText={text.empty.users}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PlatformTotalsGrid({
  overview,
  labels,
}: {
  overview: PlatformOverview;
  labels: (typeof copy)["mk"]["totals"];
}) {
  const items = [
    ["organizations", overview.totals.organizations],
    ["contactRequests", overview.totals.contactRequests],
    ["tickets", overview.totals.tickets],
    ["meetings", overview.totals.meetings],
    ["activeSubscriptions", overview.totals.activeSubscriptions],
    ["completedContactRequests", overview.totals.completedContactRequests],
    ["averageDaysToServe", overview.totals.averageDaysToServe],
    ["totalServiceValue", overview.totals.totalServiceValue],
    ["overdueServices", overview.totals.overdueServices],
    ["users", overview.totals.users],
    ["platformAdmins", overview.totals.platformAdmins],
  ] as const;
  return (
    <div className="platform-metric-grid">
      {items.map(([key, value]) => (
        <article key={key}>
          <span>{labels[key]}</span>
          <b>{value}</b>
        </article>
      ))}
    </div>
  );
}

function TenantTable({
  tenants,
  labels,
  emptyText,
}: {
  tenants: PlatformTenant[];
  labels: (typeof copy)["mk"]["tenantColumns"];
  emptyText: string;
}) {
  return (
    <section className="meeting-card platform-table-card">
      <div className="platform-table-scroll">
        <table className="platform-table">
          <thead>
            <tr>
              <th>{labels.centre}</th>
              <th>{labels.organizations}</th>
              <th>{labels.contacts}</th>
              <th>{labels.tickets}</th>
              <th>{labels.meetings}</th>
              <th>{labels.subscriptions}</th>
              <th>{labels.completed}</th>
              <th>{labels.avgDays}</th>
              <th>{labels.value}</th>
              <th>{labels.overdue}</th>
              <th>{labels.staff}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td className="platform-empty-row" colSpan={11}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="platform-detail-cell">
                    <span
                      className="tenant-swatch"
                      style={{ background: tenant.primaryColor }}
                    />
                    <b>{tenant.name}</b>
                    <small>{tenant.id}</small>
                  </td>
                  <td>{tenant.organizations}</td>
                  <td>{tenant.contactRequests}</td>
                  <td>{tenant.tickets}</td>
                  <td>{tenant.meetings}</td>
                  <td>{tenant.activeSubscriptions}</td>
                  <td>{tenant.completedContactRequests}</td>
                  <td>{tenant.averageDaysToServe}</td>
                  <td>{tenant.totalServiceValue.toLocaleString()} €</td>
                  <td>{tenant.overdueServices}</td>
                  <td>{tenant.staffMemberships}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersTable({
  users,
  loading,
  error,
  labels,
  language,
  loadingText,
  emptyText,
}: {
  users: PlatformUser[];
  loading: boolean;
  error: string;
  labels: (typeof copy)["mk"]["userColumns"];
  language: Language;
  loadingText: string;
  emptyText: string;
}) {
  return (
    <section className="meeting-card platform-table-card">
      {loading && <p>{loadingText}</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="platform-table-scroll">
        <table className="platform-table">
          <thead>
            <tr>
              <th>{labels.user}</th>
              <th>{labels.status}</th>
              <th>{labels.roles}</th>
              <th>{labels.memberships}</th>
              <th>{labels.lastLogin}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 ? (
              <tr>
                <td className="platform-empty-row" colSpan={5}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="platform-detail-cell">
                    <b>
                      {`${user.firstName} ${user.lastName}`.trim() ||
                        user.email}
                    </b>
                    <small>{user.email}</small>
                  </td>
                  <td>{labelFor(user.status, language)}</td>
                  <td>
                    {user.roles
                      .map((role) => labelFor(role, language))
                      .join(", ") || "-"}
                  </td>
                  <td>
                    {user.memberships
                      .map(
                        (item) =>
                          `${item.tenantId}: ${labelFor(item.accessLevel, language)}`,
                      )
                      .join(", ") || "-"}
                  </td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
