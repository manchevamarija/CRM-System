import { useEffect, useState } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { api, getAccessToken } from "../../api";
import { MeetingWorkspace } from "../../features/meetings/MeetingWorkspace";
import { TicketWorkspace } from "../../features/tickets/TicketWorkspace";
import { useAuth } from "../../features/auth/useAuth";
import type {
  Meeting,
  Organization,
  Profile,
  Subscription,
  SubscriptionInvitation,
  Ticket,
} from "../../shared/domain";
import type { Navigate } from "../../shared/types";
import { useApiResource } from "../../shared/useApiResource";
import { labelFor, ticketStatusClass } from "../../shared/labels";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import { dashboardCopy, localeFor } from "../../content/dashboardCopy";
import { NotificationsPopup } from "../../components/layout/NotificationsPopup";
import {
  ClientCrmPanel,
  OrganizationPanel,
  ProfilePanel,
} from "./ClientPanels";
import type {
  AccountChangeRequest,
  CrmRequest,
  NotificationItem,
  PaymentInstructions,
} from "./clientModels";
export type Tab =
  | "overview"
  | "crm"
  | "organization"
  | "tickets"
  | "meetings"
  | "notifications"
  | "profile";
export function ClientDashboardPage({
  onNavigate,
  initialTab,
  initialTicketId: initialTicketIdProp,
}: {
  onNavigate: Navigate;
  initialTab?: Tab;
  initialTicketId?: string;
}) {
  const language = usePortalLanguage();
  const t = dashboardCopy[language].client;
  const { user, logout, isAuthenticated } = useAuth();
  const managesClientTickets = Boolean(
    user?.roles.some((role) =>
      ["Admin", "HelpDeskAgent", "Expert"].includes(role),
    ),
  );
  const managedTicketLabel =
    language === "mk" ? "Тикети" : language === "sq" ? "Tiketat" : "Tickets";
  const [tab, setTab] = useState<Tab>(
    initialTicketIdProp ? "tickets" : (initialTab ?? "overview"),
  );
  const [initialTicketId, setInitialTicketId] = useState<string | undefined>(
    initialTicketIdProp,
  );
  useEffect(() => {
    if (initialTicketIdProp) {
      setInitialTicketId(initialTicketIdProp);
      setTab("tickets");
      return;
    }
    if (initialTab) setTab(initialTab);
  }, [initialTab, initialTicketIdProp]);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((value) => value + 1);
  const tickets = useApiResource<Ticket[]>(
    managesClientTickets
      ? `/api/staff/tickets?pageSize=100&v=${version}`
      : `/api/tickets/my?v=${version}`,
    isAuthenticated,
  );
  const isMeetingAdmin = Boolean(user?.roles.includes("Admin"));
  const meetings = useApiResource<Meeting[]>(
    isMeetingAdmin
      ? `/api/admin/meetings/mine?v=${version}`
      : `/api/meetings/my?v=${version}`,
    isAuthenticated,
  );
  const organization = useApiResource<Organization>(
    `/api/organizations/my?v=${version}`,
    isAuthenticated,
  );
  const subscription = useApiResource<Subscription>(
    `/api/subscriptions/my?v=${version}`,
    isAuthenticated,
  );
  const paymentInstructions = useApiResource<PaymentInstructions>(
    `/api/subscriptions/payment-instructions?v=${version}`,
    isAuthenticated && subscription.data?.status === "PendingPayment",
  );
  const invitation = useApiResource<SubscriptionInvitation>(
    `/api/subscriptions/invitations/my?v=${version}`,
    isAuthenticated,
  );
  const profile = useApiResource<Profile>(
    `/api/profile/?v=${version}`,
    isAuthenticated,
  );
  const accountChanges = useApiResource<AccountChangeRequest[]>(
    `/api/account-change-requests/my?v=${version}`,
    isAuthenticated,
  );
  const notifications = useApiResource<NotificationItem[]>(
    `/api/notifications/mine?v=${version}`,
    isAuthenticated,
  );
  const crmRequests = useApiResource<CrmRequest[]>(
    `/api/crm/my-requests?v=${version}`,
    isAuthenticated,
  );
  useEffect(() => {
    if (!isAuthenticated) return;
    const connection = new HubConnectionBuilder()
      .withUrl("/hubs/crm", {
        accessTokenFactory: () => getAccessToken() ?? "",
      })
      .withAutomaticReconnect()
      .build();
    connection.on("CrmUpdated", refresh);
    void connection.start().catch(() => undefined);
    return () => {
      void connection.stop();
    };
  }, [isAuthenticated]);
  const unreadNotifications = (notifications.data ?? []).filter(
    (item) => !item.isRead,
  ).length;
  const [notificationsPopupOpen, setNotificationsPopupOpen] = useState(false);
  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await api(`/api/notifications/${item.id}/read`, { method: "POST" });
        refresh();
      } catch {
        // Non-fatal — navigation still proceeds even if marking-read failed.
      }
    }
    setNotificationsPopupOpen(false);
    if (!item.actionUrl) return;
    const target = new URL(item.actionUrl, window.location.origin);
    const requestedTab = target.searchParams.get("tab");
    if (target.pathname === "/portal" && requestedTab) {
      setTab(requestedTab as Tab);
    }
    onNavigate(target.pathname === "/staff" ? "staff" : "dashboard", {
      tab: requestedTab ?? undefined,
      ticket: target.searchParams.get("ticket") ?? undefined,
    });
  };
  const markAllNotificationsRead = async () => {
    try {
      await api("/api/notifications/read-all", { method: "POST" });
      refresh();
    } catch {
      // Non-fatal — the popup simply keeps showing the previous read state.
    }
  };
  const deleteNotification = async (item: NotificationItem) => {
    try {
      await api(`/api/notifications/${item.id}`, { method: "DELETE" });
      refresh();
    } catch {
      // Non-fatal — the item simply stays in the list if the delete failed.
    }
  };
  const items = tickets.data ?? [];
  const canCreateTickets =
    organization.data?.status === "Approved" &&
    subscription.data?.status === "Active" &&
    Boolean(subscription.data.expiresAt) &&
    new Date(subscription.data.expiresAt!).getTime() > Date.now();
  const menu: { key: Tab; label: string }[] = [
    { key: "overview", label: t.overview },
    { key: "notifications", label: t.notifications },
    {
      key: "crm",
      label:
        language === "en"
          ? "My services"
          : language === "sq"
            ? "Shërbimet e mia"
            : "Мои услуги",
    },
    {
      key: "tickets",
      label: managesClientTickets ? managedTicketLabel : t.tickets,
    },
    {
      key: "organization",
      label:
        language === "mk"
          ? "Претплата"
          : language === "sq"
            ? "Abonimi"
            : "Subscription",
    },
    { key: "meetings", label: t.meetings },
    { key: "profile", label: t.profile },
  ];
  const openTickets = (ticketId?: string) => {
    if (managesClientTickets) {
      onNavigate(user?.roles.includes("Admin") ? "admin" : "staff", {
        tab: "tickets",
        ticket: ticketId,
      });
      return;
    }
    setInitialTicketId(ticketId);
    setTab("tickets");
  };
  return (
    <section className="dashboard">
      <aside>
        <div className="user">
          <span>{user ? `${user.firstName[0]}${user.lastName[0]}` : "КП"}</span>
          <div>
            <b>{user ? `${user.firstName} ${user.lastName}` : t.user}</b>
            <small>{t.signedIn}</small>
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
        {menu.map((item) =>
          item.key === "notifications" ? (
            <div className="notifications-anchor" key={item.key}>
              <button
                className={notificationsPopupOpen ? "sel" : ""}
                onClick={() => setNotificationsPopupOpen((value) => !value)}
              >
                <span>
                  {item.label}
                  {unreadNotifications > 0 && (
                    <span className="menu-badge">{unreadNotifications}</span>
                  )}
                </span>
                <span>›</span>
              </button>
              {notificationsPopupOpen && (
                <NotificationsPopup
                  items={notifications.data ?? []}
                  language={language}
                  onClose={() => setNotificationsPopupOpen(false)}
                  onOpenItem={openNotification}
                  onMarkAllRead={markAllNotificationsRead}
                  onDelete={deleteNotification}
                />
              )}
            </div>
          ) : (
            <button
              className={tab === item.key ? "sel" : ""}
              key={item.key}
              onClick={() =>
                item.key === "tickets" ? openTickets() : setTab(item.key)
              }
            >
              <span>{item.label}</span>
              <span>›</span>
            </button>
          ),
        )}
        {user?.roles.includes("Admin") && (
          <button onClick={() => onNavigate("admin")}>
            {t.administration} <span>›</span>
          </button>
        )}
        {user?.roles.some((role) =>
          ["HelpDeskAgent", "Expert"].includes(role),
        ) && (
          <button onClick={() => onNavigate("staff")}>
            {t.workspace} <span>›</span>
          </button>
        )}
      </aside>
      <div className="dash-main">
        <div className="dash-head">
          <div>
            <span>{t.portal}</span>
            <h1>
              {tab === "overview"
                ? `${t.welcome}, ${user?.firstName ?? t.user}.`
                : menu.find((x) => x.key === tab)?.label}
            </h1>
          </div>
          {tab !== "tickets" && tab !== "crm" && (
            <button className="primary" onClick={() => openTickets()}>
              + {t.newTicket}
            </button>
          )}
        </div>
        {tab === "overview" && (
          <>
            <div className="stats">
              <article>
                <span>{t.activeTickets}</span>
                <b>
                  {
                    items.filter(
                      (x) => !["Closed", "Resolved"].includes(x.status),
                    ).length
                  }
                </b>
                <small>
                  {tickets.loading
                    ? t.loading
                    : tickets.error || t.activeRequests}
                </small>
              </article>
              <article>
                <span>{t.nextMeeting}</span>
                <b className="date">
                  {meetings.data?.find((x) => x.startsAt)?.startsAt
                    ? new Date(
                        meetings.data.find((x) => x.startsAt)!.startsAt!,
                      ).toLocaleDateString(localeFor(language))
                    : "—"}
                </b>
                <small>
                  {meetings.data?.find((x) => x.startsAt)?.subject ??
                    t.noConfirmed}
                </small>
              </article>
              <article>
                <span>{t.subscription}</span>
                <b className="ok">
                  {subscription.data?.status
                    ? labelFor(subscription.data.status, language)
                    : invitation.data
                      ? t.invitationUpper
                      : t.inactiveUpper}
                </b>
                <small>
                  {subscription.data?.expiresAt
                    ? `${t.validUntil} ${new Date(subscription.data.expiresAt).toLocaleDateString(localeFor(language))}`
                    : t.annual}
                </small>
              </article>
            </div>
            <div className="ticket-list">
              <div className="list-head">
                <h2>{t.recentTickets}</h2>
                <button onClick={() => openTickets()}>{t.seeAll}</button>
              </div>
              {items.slice(0, 5).map((ticket) => (
                <button
                  className="ticket ticket-button"
                  key={ticket.id}
                  onClick={() => openTickets(ticket.id)}
                >
                  <span className={`tag ${ticketStatusClass(ticket.status)}`}>
                    {labelFor(ticket.status, language)}
                  </span>
                  <div>
                    <b>{ticket.title}</b>
                    <small>
                      #{ticket.ticketNumber} ·{" "}
                      {labelFor(ticket.category, language)}
                    </small>
                  </div>
                  <span>
                    {new Date(ticket.updatedAt).toLocaleDateString(
                      localeFor(language),
                    )}
                  </span>
                </button>
              ))}
              {!items.length && (
                <div className="empty-state">{t.noTickets}</div>
              )}
            </div>
          </>
        )}
        {tab === "crm" && (
          <ClientCrmPanel
            requests={crmRequests.data ?? []}
            loading={crmRequests.loading}
          />
        )}
        {tab === "organization" && (
          <OrganizationPanel
            organization={organization.data}
            subscription={subscription.data}
            invitation={invitation.data}
            paymentInstructions={paymentInstructions.data}
            changeRequests={accountChanges.data ?? []}
            onNavigate={onNavigate}
            onChanged={refresh}
          />
        )}
        {tab === "tickets" && (
          <TicketWorkspace
            tickets={items}
            onChanged={refresh}
            canCreate={canCreateTickets}
            accessMessage={dashboardCopy[language].ticket.accessRequired}
            initialTicketId={initialTicketId}
          />
        )}
        {tab === "meetings" && (
          <MeetingWorkspace
            meetings={meetings.data ?? []}
            onChanged={refresh}
            adminMode={user?.roles.includes("Admin")}
          />
        )}
        {tab === "profile" && (
          <ProfilePanel profile={profile.data} onChanged={refresh} />
        )}
      </div>
    </section>
  );
}
