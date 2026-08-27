import { useState } from "react";
import { api } from "../../../api";
import type { Ticket } from "../../../shared/domain";
import type { Navigate } from "../../../shared/types";
import { useApiResource } from "../../../shared/useApiResource";
import type { Tab } from "../AdminDashboardPage";
import type {
  AccountChangeRequest,
  AdminAttachment,
  AdminNotification,
  Audit,
  Contact,
  ContactReport,
  ContentCollection,
  CountGroup,
  CrmAnalyticsReport,
  CrmDemandReport,
  Evidence,
  EvidenceTarget,
  EvidenceTemplate,
  Kpis,
  MeetingReport,
  MyNotification,
  Organization,
  Setting,
  StaffUser,
  Subscription,
  SubscriptionInvitation,
  TicketReport,
  User,
} from "../adminModels";

type Props = {
  version: number;
  allowed: boolean;
  tab: Tab;
  evidenceEntityType: string;
  showEvidenceTargets: boolean;
  refresh: () => void;
  setTab: (tab: Tab) => void;
  onNavigate: Navigate;
};

export function useAdminResources(props: Props) {
  const {
    version,
    allowed,
    tab,
    evidenceEntityType,
    showEvidenceTargets,
    refresh,
    setTab,
    onNavigate,
  } = props;
  const kpis = useApiResource<Kpis>(
    `/api/admin/reports/kpis?v=${version}`,
    allowed,
  );
  const organizations = useApiResource<Organization[]>(
    `/api/admin/organizations?v=${version}`,
    allowed,
  );
  const users = useApiResource<User[]>(
    `/api/admin/users?v=${version}`,
    allowed,
  );
  const roleDefinitions = useApiResource<string[]>(
    `/api/admin/users/roles?v=${version}`,
    allowed && tab === "users",
  );
  const subscriptions = useApiResource<Subscription[]>(
    `/api/admin/subscriptions?v=${version}`,
    allowed,
  );
  const invitations = useApiResource<SubscriptionInvitation[]>(
    `/api/admin/subscription-invitations?v=${version}`,
    allowed && tab === "subscriptions",
  );
  const accountChanges = useApiResource<AccountChangeRequest[]>(
    `/api/admin/account-change-requests?v=${version}`,
    allowed && tab === "changes",
  );
  const staffUsers = useApiResource<StaffUser[]>(
    `/api/staff/users?v=${version}`,
    allowed && (tab === "contacts" || tab === "tickets" || tab === "meetings"),
  );
  const notifications = useApiResource<AdminNotification[]>(
    `/api/admin/notifications?v=${version}`,
    allowed && tab === "notifications",
  );
  const myNotifications = useApiResource<MyNotification[]>(
    `/api/notifications/mine?v=${version}`,
    allowed,
  );
  const unreadMyNotifications = (myNotifications.data ?? []).filter(
    (item) => !item.isRead,
  ).length;
  const [notificationsPopupOpen, setNotificationsPopupOpen] = useState(false);
  const openMyNotification = async (item: MyNotification) => {
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
    if (target.pathname === "/admin" && requestedTab) {
      setTab(requestedTab as Tab);
      return;
    }
    onNavigate(target.pathname === "/staff" ? "staff" : "admin", {
      tab: requestedTab ?? undefined,
      ticket: target.searchParams.get("ticket") ?? undefined,
    });
  };
  const markAllMyNotificationsRead = async () => {
    try {
      await api("/api/notifications/read-all", { method: "POST" });
      refresh();
    } catch {
      // Non-fatal — the popup simply keeps showing the previous read state.
    }
  };
  const deleteMyNotification = async (item: MyNotification) => {
    try {
      await api(`/api/notifications/${item.id}`, { method: "DELETE" });
      refresh();
    } catch {
      // Non-fatal — the item simply stays in the list if the delete failed.
    }
  };
  const contacts = useApiResource<Contact[]>(
    `/api/admin/contact-requests?pageSize=100&v=${version}`,
    allowed && (tab === "contacts" || tab === "overview"),
  );
  const serviceContent = useApiResource<ContentCollection>(
    `/api/admin/services?v=${version}`,
    allowed && tab === "content",
  );
  const pageContent = useApiResource<ContentCollection>(
    `/api/admin/pages?v=${version}`,
    allowed && tab === "content",
  );
  const audits = useApiResource<Audit[]>(
    `/api/admin/audit-logs?v=${version}`,
    allowed && tab === "audit",
  );
  const settings = useApiResource<Setting[]>(
    `/api/admin/settings?v=${version}`,
    allowed && (tab === "settings" || tab === "subscriptions"),
  );
  const tickets = useApiResource<Ticket[]>(
    `/api/staff/tickets?v=${version}`,
    allowed && tab === "tickets",
  );
  const attachments = useApiResource<AdminAttachment[]>(
    `/api/admin/ticket-attachments?v=${version}`,
    allowed && tab === "documents",
  );
  const evidence = useApiResource<Evidence[]>(
    `/api/admin/evidence?v=${version}`,
    allowed && tab === "evidence",
  );
  const evidenceTemplates = useApiResource<EvidenceTemplate[]>(
    `/api/admin/evidence-templates?v=${version}`,
    allowed && tab === "evidence",
  );
  const evidenceTargets = useApiResource<EvidenceTarget[]>(
    `/api/admin/evidence-targets?type=${encodeURIComponent(evidenceEntityType)}&v=${version}`,
    allowed && tab === "evidence" && showEvidenceTargets,
  );
  const contactReport = useApiResource<ContactReport>(
    `/api/admin/reports/contacts?v=${version}`,
    allowed && tab === "reports",
  );
  const ticketReport = useApiResource<TicketReport>(
    `/api/admin/reports/tickets-detailed?v=${version}`,
    allowed && tab === "reports",
  );
  const meetingReport = useApiResource<MeetingReport>(
    `/api/admin/reports/meetings?v=${version}`,
    allowed && tab === "reports",
  );
  const referralReport = useApiResource<CountGroup[]>(
    `/api/admin/reports/referrals?v=${version}`,
    allowed && tab === "reports",
  );
  const crmDemandReport = useApiResource<CrmDemandReport>(
    `/api/admin/reports/crm-demand?v=${version}`,
    allowed && tab === "reports",
  );
  const crmAnalyticsReport = useApiResource<CrmAnalyticsReport>(
    `/api/admin/reports/crm-analytics?v=${version}`,
    allowed && tab === "reports",
  );

  return {
    kpis,
    organizations,
    users,
    roleDefinitions,
    subscriptions,
    invitations,
    accountChanges,
    staffUsers,
    notifications,
    myNotifications,
    unreadMyNotifications,
    notificationsPopupOpen,
    setNotificationsPopupOpen,
    openMyNotification,
    markAllMyNotificationsRead,
    deleteMyNotification,
    contacts,
    serviceContent,
    pageContent,
    audits,
    settings,
    tickets,
    attachments,
    evidence,
    evidenceTemplates,
    evidenceTargets,
    contactReport,
    ticketReport,
    meetingReport,
    referralReport,
    crmDemandReport,
    crmAnalyticsReport,
  };
}
