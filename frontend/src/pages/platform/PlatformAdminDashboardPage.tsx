import { useMemo, useState } from "react";
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
    descriptions: {
      overview: "Глобален преглед на сите центри, корисници и CRM активност.",
      tenants: "Споредба на CRM обемот, услугите и тимот по центар.",
      users: "Пребарување и преглед на корисници, улоги и членства по центар.",
    },
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
    search: {
      label: "Пребарај корисници",
      placeholder: "Име, email, улога или центар",
      clear: "Исчисти",
      noResults: "Нема корисници што одговараат на пребарувањето.",
    },
    filters: {
      centreSearch: "Пребарај центри",
      centrePlaceholder: "Центар или ID",
      overdueOnly: "Само центри со задоцнети услуги",
      status: "Статус",
      role: "Улога",
      centre: "Центар",
      allStatuses: "Сите статуси",
      allRoles: "Сите улоги",
      allCentres: "Сите центри",
      noCentreResults: "Нема центри што одговараат на филтрите.",
    },
    export: {
      tenants: "Извези центри",
      users: "Извези корисници",
    },
  },
  en: {
    title: "Platform Admin",
    eyebrow: "Global administration",
    overview: "Overview",
    tenants: "Centres",
    users: "Users",
    descriptions: {
      overview: "A global view of all centres, users and CRM activity.",
      tenants: "Compare CRM volume, services and team coverage by centre.",
      users: "Search and review users, roles and centre memberships.",
    },
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
      platformAdmins: "Platform administrators",
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
      staff: "Team",
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
    search: {
      label: "Search users",
      placeholder: "Name, email, role or centre",
      clear: "Clear",
      noResults: "No users match your search.",
    },
    filters: {
      centreSearch: "Search centres",
      centrePlaceholder: "Centre or ID",
      overdueOnly: "Only with overdue services",
      status: "Status",
      role: "Role",
      centre: "Centre",
      allStatuses: "All statuses",
      allRoles: "All roles",
      allCentres: "All centres",
      noCentreResults: "No centres match the filters.",
    },
    export: {
      tenants: "Export centres",
      users: "Export users",
    },
  },
  sq: {
    title: "Platform Admin",
    eyebrow: "Administrim global",
    overview: "Përmbledhje",
    tenants: "Qendra",
    users: "Përdorues",
    descriptions: {
      overview:
        "Pamje globale e të gjitha qendrave, përdoruesve dhe aktivitetit CRM.",
      tenants: "Krahasoni vëllimin CRM, shërbimet dhe ekipin sipas qendrës.",
      users:
        "Kërkoni dhe shqyrtoni përdoruesit, rolet dhe anëtarësimet në qendra.",
    },
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
    search: {
      label: "Kërko përdorues",
      placeholder: "Emër, email, rol ose qendër",
      clear: "Pastro",
      noResults: "Asnjë përdorues nuk përputhet me kërkimin.",
    },
    filters: {
      centreSearch: "Kërko qendra",
      centrePlaceholder: "Qendër ose ID",
      overdueOnly: "Vetëm me afate të vonuara",
      status: "Statusi",
      role: "Roli",
      centre: "Qendra",
      allStatuses: "Të gjitha statuset",
      allRoles: "Të gjitha rolet",
      allCentres: "Të gjitha qendrat",
      noCentreResults: "Asnjë qendër nuk përputhet me filtrat.",
    },
    export: {
      tenants: "Eksporto qendrat",
      users: "Eksporto përdoruesit",
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
  const tenantCount = overview.data?.tenants.length ?? 0;
  const userCount = users.data?.length ?? overview.data?.totals.users ?? 0;

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
          <span>
            {text.tenants}
            <small className="platform-tab-count">{tenantCount}</small>
          </span>
          <span>›</span>
        </button>
        <button
          className={tab === "users" ? "sel" : ""}
          onClick={() => setTab("users")}
        >
          <span>
            {text.users}
            <small className="platform-tab-count">{userCount}</small>
          </span>
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
            <p className="platform-admin-description">
              {text.descriptions[tab]}
            </p>
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
                search={text.search}
                filters={text.filters}
                exportLabel={text.export.tenants}
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
                search={text.search}
                filters={text.filters}
                exportLabel={text.export.users}
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
  search,
  filters,
  exportLabel,
  emptyText,
}: {
  tenants: PlatformTenant[];
  labels: (typeof copy)["mk"]["tenantColumns"];
  search: (typeof copy)["mk"]["search"];
  filters: (typeof copy)["mk"]["filters"];
  exportLabel: string;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTenants = useMemo(
    () =>
      tenants.filter((tenant) => {
        const matchesQuery =
          !normalizedQuery ||
          [tenant.name, tenant.id]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        const matchesOverdue = !overdueOnly || tenant.overdueServices > 0;
        return matchesQuery && matchesOverdue;
      }),
    [normalizedQuery, overdueOnly, tenants],
  );
  const emptyMessage =
    normalizedQuery || overdueOnly ? filters.noCentreResults : emptyText;

  return (
    <section className="meeting-card platform-table-card">
      <div className="platform-table-toolbar">
        <label className="platform-search">
          <span>{filters.centreSearch}</span>
          <input
            type="search"
            value={query}
            placeholder={filters.centrePlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="platform-filter-check">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
          />
          <span>{filters.overdueOnly}</span>
        </label>
        {query && (
          <button
            className="secondary"
            type="button"
            onClick={() => setQuery("")}
          >
            {search.clear}
          </button>
        )}
        <button
          className="secondary platform-export-button"
          type="button"
          onClick={() => exportTenantsCsv(filteredTenants, labels)}
          disabled={filteredTenants.length === 0}
        >
          {exportLabel}
        </button>
      </div>
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
            {filteredTenants.length === 0 ? (
              <tr>
                <td className="platform-empty-row" colSpan={11}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="platform-detail-cell">
                    <span
                      className="tenant-swatch"
                      style={{ background: tenant.primaryColor }}
                    />
                    <div className="platform-detail-content">
                      <b>{tenant.name}</b>
                      <small>{tenant.id}</small>
                    </div>
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
      <div className="platform-mobile-list">
        {filteredTenants.length === 0 ? (
          <p className="platform-mobile-empty">{emptyMessage}</p>
        ) : (
          filteredTenants.map((tenant) => (
            <article className="platform-mobile-row" key={tenant.id}>
              <header>
                <span
                  className="tenant-swatch"
                  style={{ background: tenant.primaryColor }}
                />
                <div>
                  <b>{tenant.name}</b>
                  <small>{tenant.id}</small>
                </div>
              </header>
              <dl>
                <div>
                  <dt>{labels.contacts}</dt>
                  <dd>{tenant.contactRequests}</dd>
                </div>
                <div>
                  <dt>{labels.subscriptions}</dt>
                  <dd>{tenant.activeSubscriptions}</dd>
                </div>
                <div>
                  <dt>{labels.completed}</dt>
                  <dd>{tenant.completedContactRequests}</dd>
                </div>
                <div>
                  <dt>{labels.staff}</dt>
                  <dd>{tenant.staffMemberships}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
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
  search,
  filters,
  exportLabel,
  loadingText,
  emptyText,
}: {
  users: PlatformUser[];
  loading: boolean;
  error: string;
  labels: (typeof copy)["mk"]["userColumns"];
  language: Language;
  search: (typeof copy)["mk"]["search"];
  filters: (typeof copy)["mk"]["filters"];
  exportLabel: string;
  loadingText: string;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [roleFilter, setRoleFilter] = useState("");
  const [centreFilter, setCentreFilter] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(["Active", ...users.map((user) => user.status)]),
      ).sort(),
    [users],
  );
  const roleOptions = useMemo(
    () =>
      Array.from(new Set(users.flatMap((user) => user.roles))).sort((a, b) =>
        labelFor(a, language).localeCompare(labelFor(b, language)),
      ),
    [language, users],
  );
  const centreOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            user.memberships.map((membership) => membership.tenantId),
          ),
        ),
      ).sort(),
    [users],
  );
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesStatus = !statusFilter || user.status === statusFilter;
      const matchesRole = !roleFilter || user.roles.includes(roleFilter);
      const matchesCentre =
        !centreFilter ||
        user.memberships.some(
          (membership) => membership.tenantId === centreFilter,
        );
      if (!matchesStatus || !matchesRole || !matchesCentre) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        user.firstName,
        user.lastName,
        user.email,
        labelFor(user.status, language),
        ...user.roles.map((role) => labelFor(role, language)),
        ...user.memberships.flatMap((item) => [
          item.tenantId,
          item.accessLevel,
          labelFor(item.accessLevel, language),
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [
    centreFilter,
    language,
    normalizedQuery,
    roleFilter,
    statusFilter,
    users,
  ]);
  const hasFilters =
    !!normalizedQuery ||
    statusFilter !== "Active" ||
    !!roleFilter ||
    !!centreFilter;
  const emptyMessage = hasFilters ? search.noResults : emptyText;
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("Active");
    setRoleFilter("");
    setCentreFilter("");
  };

  return (
    <section className="meeting-card platform-table-card">
      {loading && <p>{loadingText}</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="platform-table-scroll platform-users-scroll">
        <table className="platform-table platform-users-table">
          <colgroup>
            <col style={{ width: "29%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr className="platform-users-filter-row">
              <th className="platform-users-filter-cell">
                <label>
                  <span>{search.label}</span>
                  <input
                    type="search"
                    value={query}
                    placeholder={search.placeholder}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </th>
              <th className="platform-users-filter-cell">
                <label>
                  <span>{filters.status}</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">{filters.allStatuses}</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {labelFor(status, language)}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="platform-users-filter-cell">
                <label>
                  <span>{filters.role}</span>
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                  >
                    <option value="">{filters.allRoles}</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {labelFor(role, language)}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="platform-users-filter-cell">
                <label>
                  <span>{filters.centre}</span>
                  <select
                    value={centreFilter}
                    onChange={(event) => setCentreFilter(event.target.value)}
                  >
                    <option value="">{filters.allCentres}</option>
                    {centreOptions.map((centre) => (
                      <option key={centre} value={centre}>
                        {centre}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="platform-users-filter-cell">
                <div className="platform-users-filter-actions">
                  {hasFilters && (
                    <button className="secondary" type="button" onClick={clearFilters}>
                      {search.clear}
                    </button>
                  )}
                  <button
                    className="secondary platform-export-button"
                    type="button"
                    onClick={() => exportUsersCsv(filteredUsers, labels, language)}
                    disabled={filteredUsers.length === 0}
                  >
                    {exportLabel}
                  </button>
                </div>
              </th>
            </tr>
            <tr>
              <th>{labels.user}</th>
              <th>{labels.status}</th>
              <th>{labels.roles}</th>
              <th>{labels.memberships}</th>
              <th>{labels.lastLogin}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredUsers.length === 0 ? (
              <tr>
                <td className="platform-empty-row" colSpan={5}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="platform-detail-cell">
                    <b>
                      {`${user.firstName} ${user.lastName}`.trim() ||
                        user.email}
                    </b>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <StatusBadge status={user.status} language={language} />
                  </td>
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
                  <td>
                    <span className="platform-date-cell">
                      {formatDate(user.lastLoginAt)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="platform-mobile-list">
        {!loading && filteredUsers.length === 0 ? (
          <p className="platform-mobile-empty">{emptyMessage}</p>
        ) : (
          filteredUsers.map((user) => (
            <article className="platform-mobile-row" key={user.id}>
              <header>
                <div>
                  <b>
                    {`${user.firstName} ${user.lastName}`.trim() || user.email}
                  </b>
                  <small>{user.email}</small>
                </div>
              </header>
              <dl>
                <div>
                  <dt>{labels.status}</dt>
                  <dd>
                    <StatusBadge status={user.status} language={language} />
                  </dd>
                </div>
                <div>
                  <dt>{labels.roles}</dt>
                  <dd>
                    {user.roles
                      .map((role) => labelFor(role, language))
                      .join(", ") || "-"}
                  </dd>
                </div>
                <div>
                  <dt>{labels.memberships}</dt>
                  <dd>
                    {user.memberships
                      .map(
                        (item) =>
                          `${item.tenantId}: ${labelFor(item.accessLevel, language)}`,
                      )
                      .join(", ") || "-"}
                  </dd>
                </div>
                <div>
                  <dt>{labels.lastLogin}</dt>
                  <dd>
                    <span className="platform-date-cell">
                      {formatDate(user.lastLoginAt)}
                    </span>
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  language,
}: {
  status: PlatformUser["status"];
  language: Language;
}) {
  return (
    <span className={`platform-status-badge ${statusClass(status)}`}>
      {labelFor(status, language)}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: PlatformUser["status"]) {
  if (status === "Active") return "is-active";
  if (status === "PendingVerification") return "is-pending";
  return "is-muted";
}

function exportTenantsCsv(
  tenants: PlatformTenant[],
  labels: (typeof copy)["mk"]["tenantColumns"],
) {
  downloadCsv("platform-admin-centres.csv", [
    [
      labels.centre,
      labels.organizations,
      labels.contacts,
      labels.tickets,
      labels.meetings,
      labels.subscriptions,
      labels.completed,
      labels.avgDays,
      labels.value,
      labels.overdue,
      labels.staff,
    ],
    ...tenants.map((tenant) => [
      tenant.name,
      tenant.organizations,
      tenant.contactRequests,
      tenant.tickets,
      tenant.meetings,
      tenant.activeSubscriptions,
      tenant.completedContactRequests,
      tenant.averageDaysToServe,
      tenant.totalServiceValue,
      tenant.overdueServices,
      tenant.staffMemberships,
    ]),
  ]);
}

function exportUsersCsv(
  users: PlatformUser[],
  labels: (typeof copy)["mk"]["userColumns"],
  language: Language,
) {
  downloadCsv("platform-admin-users.csv", [
    [
      labels.user,
      "Email",
      labels.status,
      labels.roles,
      labels.memberships,
      labels.lastLogin,
    ],
    ...users.map((user) => [
      `${user.firstName} ${user.lastName}`.trim() || user.email,
      user.email,
      labelFor(user.status, language),
      user.roles.map((role) => labelFor(role, language)).join(", "),
      user.memberships
        .map(
          (item) => `${item.tenantId}: ${labelFor(item.accessLevel, language)}`,
        )
        .join(", "),
      formatDate(user.lastLoginAt),
    ]),
  ]);
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
