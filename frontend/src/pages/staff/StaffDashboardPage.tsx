import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth/useAuth";
import type { Meeting, Ticket } from "../../shared/domain";
import type { Navigate } from "../../shared/types";
import { useApiResource } from "../../shared/useApiResource";
import { labelFor, ticketStatusClass } from "../../shared/labels";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import { workspaceCopy } from "../../content/workspaceCopy";
import { StaffTicketDetail } from "./StaffTicketDetail";
import { StaffMeetingsPanel } from "./StaffMeetingsPanel";
import { StaffContactsPanel } from "./StaffContactsPanel";
import type { StaffContact, StaffUser } from "./staffModels";

type Tab = "tickets" | "meetings" | "contacts";

export function StaffDashboardPage({
  onNavigate,
  initialTicketId,
}: {
  onNavigate: Navigate;
  initialTicketId?: string;
}) {
  const language = usePortalLanguage();
  const t = workspaceCopy(language);
  const { user, logout } = useAuth();
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("meetings");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [openedInitialTicketId, setOpenedInitialTicketId] = useState<string>();
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [ticketCategory, setTicketCategory] = useState("");
  const [error, setError] = useState("");
  const enabled = !!user?.roles.some((role) =>
    ["Admin", "HelpDeskAgent", "Expert"].includes(role),
  );
  const canTriage = !!user?.roles.some((role) =>
    ["Admin", "HelpDeskAgent"].includes(role),
  );
  const refresh = () => setVersion((value) => value + 1);
  const tickets = useApiResource<Ticket[]>(
    `/api/staff/tickets?pageSize=100&v=${version}`,
    enabled,
  );
  useEffect(() => {
    if (!initialTicketId || openedInitialTicketId === initialTicketId) return;
    const ticket = tickets.data?.find((item) => item.id === initialTicketId);
    if (!ticket) return;
    setTab("tickets");
    setSelected(ticket);
    setOpenedInitialTicketId(initialTicketId);
  }, [initialTicketId, openedInitialTicketId, tickets.data]);
  const meetings = useApiResource<Meeting[]>(
    `/api/staff/meetings?v=${version}`,
    enabled,
  );
  const staff = useApiResource<StaffUser[]>(
    `/api/staff/users?v=${version}`,
    enabled && canTriage,
  );
  const contacts = useApiResource<StaffContact[]>(
    `/api/staff/contact-requests?pageSize=100&v=${version}`,
    enabled && tab === "contacts",
  );
  if (user && !enabled)
    return (
      <section className="page">
        <h1>{t.noStaffAccess}</h1>
        <button className="secondary" onClick={() => onNavigate("dashboard")}>
          {t.back}
        </button>
      </section>
    );
  const tabs: { key: Tab; label: string }[] = [
    { key: "tickets", label: t.triage },
    { key: "meetings", label: t.calendarMeetings },
    { key: "contacts" as const, label: t.contactRequests },
  ];
  const visibleTickets = (tickets.data ?? []).filter(
    (ticket) =>
      (!ticketSearch ||
        `${ticket.ticketNumber} ${ticket.title} ${ticket.description}`
          .toLocaleLowerCase()
          .includes(ticketSearch.toLocaleLowerCase())) &&
      (!ticketStatus || ticket.status === ticketStatus) &&
      (!ticketCategory || ticket.category === ticketCategory),
  );
  const newTicketsCount = (tickets.data ?? []).filter(
    (ticket) => ticket.status === "New",
  ).length;
  return (
    <section className="dashboard">
      <aside>
        <div className="user">
          <span>HD</span>
          <div>
            <b>{user?.email ?? t.helpDeskAgent}</b>
            <small>{t.staffArea}</small>
          </div>
        </div>
        <button
          className="logout"
          onClick={async () => {
            await logout();
            onNavigate("home");
          }}
        >
          {t.logout}
        </button>
        {tabs.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? "sel" : ""}
            onClick={() => {
              setTab(item.key);
              setSelected(null);
            }}
          >
            {item.label}
            {item.key === "tickets" && newTicketsCount > 0 && (
              <span className="menu-badge">{newTicketsCount}</span>
            )}
            <span>›</span>
          </button>
        ))}
        <button onClick={() => onNavigate("dashboard")}>
          {t.clientPortal} <span>›</span>
        </button>
        {user?.roles.includes("Admin") && (
          <button onClick={() => onNavigate("admin")}>
            {t.administration} <span>›</span>
          </button>
        )}
      </aside>
      <div className="dash-main">
        <div className="dash-head">
          <div>
            <span>{t.staffWorkspace}</span>
            <h1>{tabs.find((item) => item.key === tab)?.label}</h1>
          </div>
        </div>
        {tab === "tickets" &&
          (selected ? (
            <StaffTicketDetail
              ticket={selected}
              staff={staff.data ?? []}
              onBack={() => setSelected(null)}
              onChanged={() => {
                refresh();
                setSelected(null);
              }}
              language={language}
              canAssign={canTriage}
            />
          ) : (
            <>
              <div className="stats">
                <article>
                  <span>{t.new}</span>
                  <b>
                    {tickets.data?.filter((x) => x.status === "New").length ??
                      0}
                  </b>
                </article>
                <article>
                  <span>{t.inProgress}</span>
                  <b>
                    {tickets.data?.filter((x) => x.status === "InProgress")
                      .length ?? 0}
                  </b>
                </article>
                <article>
                  <span>{t.urgent}</span>
                  <b>
                    {tickets.data?.filter((x) => x.priority === "Urgent")
                      .length ?? 0}
                  </b>
                </article>
              </div>
              <div className="ticket-list">
                <div className="list-head">
                  <h2>{t.ticketsForWork}</h2>
                </div>
                <div className="ticket-filters">
                  <input
                    value={ticketSearch}
                    onChange={(event) => setTicketSearch(event.target.value)}
                    placeholder={
                      language === "mk"
                        ? "Пребарај по број или наслов"
                        : language === "sq"
                          ? "Kërko sipas numrit ose titullit"
                          : "Search by number or title"
                    }
                  />
                  <select
                    value={ticketStatus}
                    onChange={(event) => setTicketStatus(event.target.value)}
                  >
                    <option value="">
                      {language === "mk"
                        ? "Сите статуси"
                        : language === "sq"
                          ? "Të gjitha statuset"
                          : "All statuses"}
                    </option>
                    {[
                      "New",
                      "Assigned",
                      "InProgress",
                      "Resolved",
                      "Closed",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {labelFor(value, language)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ticketCategory}
                    onChange={(event) => setTicketCategory(event.target.value)}
                  >
                    <option value="">
                      {language === "mk"
                        ? "Сите категории"
                        : language === "sq"
                          ? "Të gjitha kategoritë"
                          : "All categories"}
                    </option>
                    {Array.from(
                      new Set(
                        (tickets.data ?? []).map((ticket) => ticket.category),
                      ),
                    ).map((value) => (
                      <option key={value} value={value}>
                        {labelFor(value, language)}
                      </option>
                    ))}
                  </select>
                </div>
                {visibleTickets.map((ticket) => (
                  <button
                    className="ticket ticket-button"
                    key={ticket.id}
                    onClick={() => setSelected(ticket)}
                  >
                    <span className={`tag ${ticketStatusClass(ticket.status)}`}>
                      {labelFor(ticket.status, language)}
                    </span>
                    <div>
                      <b>{ticket.title}</b>
                      <small>
                        #{ticket.ticketNumber} ·{" "}
                        {labelFor(ticket.category, language)} ·{" "}
                        {labelFor(ticket.priority, language)}
                      </small>
                    </div>
                  </button>
                ))}
                {!visibleTickets.length && (
                  <div className="empty-state">
                    {language === "mk"
                      ? "Нема тикети што одговараат на филтрите."
                      : language === "sq"
                        ? "Nuk ka tiketa që përputhen me filtrat."
                        : "No tickets match the filters."}
                  </div>
                )}
              </div>
            </>
          ))}
        {tab === "meetings" && (
          <StaffMeetingsPanel
            meetings={meetings.data ?? []}
            loading={meetings.loading}
            staff={staff.data ?? []}
            canTriage={canTriage}
            canSchedule={Boolean(user?.roles.includes("Admin"))}
            language={language}
            onChanged={refresh}
            onError={setError}
          />
        )}
        {tab === "contacts" && (
          <StaffContactsPanel
            contacts={contacts.data ?? []}
            loading={contacts.loading}
            language={language}
            onError={setError}
            onChanged={refresh}
          />
        )}
        {(error || tickets.error || contacts.error) && (
          <p className="form-error">
            {error || tickets.error || contacts.error}
          </p>
        )}
      </div>
    </section>
  );
}
