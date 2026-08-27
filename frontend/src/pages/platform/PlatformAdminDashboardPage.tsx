import { useState } from "react";
import { useAuth } from "../../features/auth/useAuth";
import type { Navigate } from "../../shared/types";
import { useApiResource } from "../../shared/useApiResource";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import type {
  PlatformAudit,
  PlatformOverview,
  PlatformTenant,
  PlatformUser,
} from "../admin/adminModels";

type Tab = "tenants" | "users" | "audit";

const copy = {
  mk: {
    title: "Platform Admin",
    eyebrow: "Глобална администрација",
    tenants: "Центри",
    users: "Корисници",
    audit: "Audit",
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
      platformAdmins: "Platform admins",
    },
    tenantColumns: {
      centre: "Центар",
      organizations: "Орг.",
      contacts: "Контакти",
      tickets: "Тикети",
      meetings: "Состаноци",
      subscriptions: "Претплати",
      staff: "Staff",
      audit: "Audit",
    },
    userColumns: {
      user: "Корисник",
      status: "Статус",
      roles: "Улоги",
      memberships: "Центри",
      lastLogin: "Последна најава",
    },
    auditColumns: {
      event: "Настан",
      tenant: "Центар",
      entity: "Ентитет",
      actor: "Актер",
      time: "Време",
    },
  },
  en: {
    title: "Platform Admin",
    eyebrow: "Global administration",
    tenants: "Centres",
    users: "Users",
    audit: "Audit",
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
    },
    tenantColumns: {
      centre: "Centre",
      organizations: "Org.",
      contacts: "Contacts",
      tickets: "Tickets",
      meetings: "Meetings",
      subscriptions: "Subscriptions",
      staff: "Staff",
      audit: "Audit",
    },
    userColumns: {
      user: "User",
      status: "Status",
      roles: "Roles",
      memberships: "Centres",
      lastLogin: "Last login",
    },
    auditColumns: {
      event: "Event",
      tenant: "Centre",
      entity: "Entity",
      actor: "Actor",
      time: "Time",
    },
  },
  sq: {
    title: "Platform Admin",
    eyebrow: "Administrim global",
    tenants: "Qendra",
    users: "Përdorues",
    audit: "Audit",
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
      platformAdmins: "Platform admins",
    },
    tenantColumns: {
      centre: "Qendra",
      organizations: "Org.",
      contacts: "Kontakte",
      tickets: "Tiketa",
      meetings: "Takime",
      subscriptions: "Abonime",
      staff: "Staff",
      audit: "Audit",
    },
    userColumns: {
      user: "Përdorues",
      status: "Statusi",
      roles: "Role",
      memberships: "Qendra",
      lastLogin: "Hyrja e fundit",
    },
    auditColumns: {
      event: "Ngjarja",
      tenant: "Qendra",
      entity: "Entiteti",
      actor: "Aktori",
      time: "Koha",
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
  const [tab, setTab] = useState<Tab>("tenants");
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
        <button
          className={tab === "audit" ? "sel" : ""}
          onClick={() => setTab("audit")}
        >
          <span>{text.audit}</span>
          <span>›</span>
        </button>
        <button onClick={() => onNavigate("admin")}>Admin ›</button>
      </aside>
      <div className="dash-main">
        <div className="dash-head">
          <div>
            <span>{text.eyebrow}</span>
            <h1>
              {tab === "tenants"
                ? text.tenants
                : tab === "users"
                  ? text.users
                  : text.audit}
            </h1>
          </div>
        </div>
        {overview.error && (
          <p className="form-error dashboard-feedback">{overview.error}</p>
        )}
        {overview.loading && <p>{text.loading}</p>}
        {overview.data && (
          <>
            <PlatformTotalsGrid overview={overview.data} labels={text.totals} />
            {tab === "tenants" && (
              <TenantTable
                tenants={overview.data.tenants}
                labels={text.tenantColumns}
              />
            )}
            {tab === "users" && (
              <UsersTable
                users={users.data ?? []}
                loading={users.loading}
                error={users.error}
                labels={text.userColumns}
                loadingText={text.loading}
              />
            )}
            {tab === "audit" && (
              <AuditTable
                rows={overview.data.recentAudit}
                labels={text.auditColumns}
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
}: {
  tenants: PlatformTenant[];
  labels: (typeof copy)["mk"]["tenantColumns"];
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
              <th>{labels.staff}</th>
              <th>{labels.audit}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
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
                <td>{tenant.staffMemberships}</td>
                <td>{tenant.auditEvents}</td>
              </tr>
            ))}
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
  loadingText,
}: {
  users: PlatformUser[];
  loading: boolean;
  error: string;
  labels: (typeof copy)["mk"]["userColumns"];
  loadingText: string;
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
            {users.map((user) => (
              <tr key={user.id}>
                <td className="platform-detail-cell">
                  <b>
                    {`${user.firstName} ${user.lastName}`.trim() || user.email}
                  </b>
                  <small>{user.email}</small>
                </td>
                <td>{user.status}</td>
                <td>{user.roles.join(", ") || "-"}</td>
                <td>
                  {user.memberships
                    .map((item) => `${item.tenantId}: ${item.accessLevel}`)
                    .join(", ") || "-"}
                </td>
                <td>{formatDate(user.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditTable({
  rows,
  labels,
}: {
  rows: PlatformAudit[];
  labels: (typeof copy)["mk"]["auditColumns"];
}) {
  return (
    <section className="meeting-card platform-table-card">
      <div className="platform-table-scroll">
        <table className="platform-table">
          <thead>
            <tr>
              <th>{labels.event}</th>
              <th>{labels.tenant}</th>
              <th>{labels.entity}</th>
              <th>{labels.actor}</th>
              <th>{labels.time}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.action}</td>
                <td>{row.tenantId}</td>
                <td className="platform-detail-cell">
                  <b>{row.entityType}</b>
                  <small>{row.entityId}</small>
                </td>
                <td>{row.actorUserId ?? "-"}</td>
                <td>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
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
