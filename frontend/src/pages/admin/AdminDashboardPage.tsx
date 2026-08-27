import { useState } from "react";
import {
  DocumentPreview,
  type PreviewDocument,
} from "../../components/documents/DocumentPreview";
import { useAuth } from "../../features/auth/useAuth";
import type { Navigate } from "../../shared/types";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import { workspaceCopy } from "../../content/workspaceCopy";
import { uiCopy } from "../../content/uiCopy";
import { AdminOverview } from "../../features/admin/overview/AdminOverview";
import { AdminOrganizations } from "../../features/admin/organizations/AdminOrganizations";
import { AdminContent } from "../../features/admin/content/AdminContent";
import { AdminUsers } from "../../features/admin/users/AdminUsers";
import { AdminSettings } from "../../features/admin/settings/AdminSettings";
import { AdminNotifications } from "../../features/admin/notifications/AdminNotifications";
import { AdminAudit } from "../../features/admin/audit/AdminAudit";
import { AdminReports } from "../../features/admin/reports/AdminReports";
import { AdminDocuments } from "../../features/admin/documents/AdminDocuments";
import { AdminTickets } from "../../features/admin/tickets/AdminTickets";
import { AdminContacts } from "../../features/admin/contacts/AdminContacts";
import { AdminSubscriptions } from "../../features/admin/subscriptions/AdminSubscriptions";
import { AdminEvidence } from "../../features/admin/evidence/AdminEvidence";
import { StaffMeetingsPanel } from "../staff/StaffMeetingsPanel";
import type { Meeting } from "../../shared/domain";
import { useApiResource } from "../../shared/useApiResource";
import { useAdminResources } from "./hooks/useAdminResources";
import { useAdminCommands } from "./hooks/useAdminCommands";

import type { Contact, OrgDetail } from "./adminModels";
import { buildAdminMenu, calculateCrmMetrics } from "./adminDashboardHelpers";
import { AdminSidebar } from "./AdminSidebar";
export type Tab =
  | "overview"
  | "myNotifications"
  | "organizations"
  | "changes"
  | "subscriptions"
  | "contacts"
  | "tickets"
  | "meetings"
  | "documents"
  | "users"
  | "content"
  | "reports"
  | "evidence"
  | "settings"
  | "notifications"
  | "audit";

export function AdminDashboardPage({
  onNavigate,
  initialTab,
  initialTicketId,
  initialOrganizationId,
}: {
  onNavigate: Navigate;
  initialTab?: Tab;
  initialTicketId?: string;
  initialOrganizationId?: string;
}) {
  const language = usePortalLanguage();
  const crmText = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const t = workspaceCopy(language);
  const dma = uiCopy[language].dma;
  const { user, logout } = useAuth();
  const allowed = !!user?.roles.includes("Admin");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>(initialTab ?? "overview");
  const [scopedError, setScopedError] = useState<{
    tab: Tab;
    message: string;
  } | null>(null);
  const [scopedSuccess, setScopedSuccess] = useState<{
    tab: Tab;
    message: string;
  } | null>(null);
  const [retryingNotificationId, setRetryingNotificationId] =
    useState<string>();
  const setError = (message: string) => setScopedError({ tab, message });
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [contactDetail, setContactDetail] = useState<Contact | null>(null);
  const [preview, setPreview] = useState<PreviewDocument>();
  const [selectedSubscriptionUserId, setSelectedSubscriptionUserId] =
    useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]);
  const [evidenceView, setEvidenceView] = useState<
    "upload" | "templates" | "register"
  >("upload");
  const [evidenceEntityType, setEvidenceEntityType] = useState("Ticket");
  const [evidenceRelatedId, setEvidenceRelatedId] = useState("");
  const [showEvidenceTargets, setShowEvidenceTargets] = useState(false);
  const refresh = () => setVersion((value) => value + 1);
  const adminMeetings = useApiResource<Meeting[]>(
    `/api/staff/meetings?v=${version}`,
    allowed && tab === "meetings",
  );
  const {
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
  } = useAdminResources({
    version,
    allowed,
    tab,
    evidenceEntityType,
    showEvidenceTargets,
    refresh,
    setTab,
    onNavigate,
  });
  const {
    call,
    retryNotification,
    orgAction,
    orgMembers,
    loadContact,
    updateContactStatus,
    updateContactService,
    invite,
    renewSubscription,
    activate,
    role,
    createUser,
    createRole,
    removeRole,
    toggleUserStatus,
    assignContact,
    linkContact,
    saveContent,
    saveSetting,
    savePaymentInstructions,
    exportReport,
    uploadEvidence,
    downloadEvidence,
    downloadAttachment,
    downloadTemplate,
  } = useAdminCommands({
    language,
    t,
    tab,
    initialOrganizationId,
    refresh,
    setError,
    setScopedError,
    setScopedSuccess,
    setRetryingNotificationId,
    setOrgDetail,
    setContactDetail,
    setEvidenceRelatedId,
    setShowEvidenceTargets,
    setEvidenceView,
  });
  const settingValue = (key: string) =>
    settings.data?.find((item) => item.key === key)?.value ?? "";
  const selectedSubscriptionUser = (users.data ?? []).find(
    (item) => item.id === selectedSubscriptionUserId,
  );
  const crmContacts = contacts.data ?? [];
  const crmMetrics = calculateCrmMetrics(crmContacts);
  const crmStatusOrder = crmMetrics.statusOrder;
  const crmStatusCounts = crmMetrics.statusCounts;
  const activeCrmClients = crmMetrics.activeClients;
  const assignedCrmAgents = crmMetrics.assignedAgents;
  const totalCrmValue = crmMetrics.totalValue;
  if (user && !allowed)
    return (
      <section className="page">
        <h1>{t.noAdminAccess}</h1>
        <button className="secondary" onClick={() => onNavigate("dashboard")}>
          {t.back}
        </button>
      </section>
    );
  const menu = buildAdminMenu(t, language);
  return (
    <section className="dashboard admin">
      <AdminSidebar
        t={t}
        language={language}
        userEmail={user?.email}
        tab={tab}
        menu={menu}
        newTickets={kpis.data?.newTickets ?? 0}
        notifications={myNotifications.data ?? []}
        unreadNotifications={unreadMyNotifications}
        popupOpen={notificationsPopupOpen}
        setPopupOpen={setNotificationsPopupOpen}
        onSelect={(nextTab) => {
          setTab(nextTab);
          setScopedError(null);
        }}
        onOpenNotification={openMyNotification}
        onMarkAllRead={markAllMyNotificationsRead}
        onDeleteNotification={deleteMyNotification}
        onNavigate={onNavigate}
        onLogout={async () => {
          await logout();
          onNavigate("home");
        }}
      />
      <div className="dash-main">
        <div className="dash-head">
          <div>
            <span>{t.adminCenter}</span>
            <h1>{menu.find((item) => item.key === tab)?.label}</h1>
          </div>
        </div>
        {((scopedError?.tab === tab && scopedError.message) ||
          (tab === "overview" && kpis.error)) && (
          <p className="form-error dashboard-feedback">
            {scopedError?.tab === tab ? scopedError.message : kpis.error}
          </p>
        )}
        {scopedSuccess?.tab === tab && (
          <p className="form-success dashboard-feedback">
            {scopedSuccess.message}
          </p>
        )}
        {tab === "overview" && (
          <AdminOverview
            t={t}
            language={language}
            kpis={kpis.data}
            contacts={crmContacts}
            statusOrder={crmStatusOrder}
            statusCounts={crmStatusCounts}
            activeClients={activeCrmClients}
            assignedAgents={assignedCrmAgents}
            totalValue={totalCrmValue}
            crmText={crmText}
            onTab={setTab}
          />
        )}
        {tab === "organizations" && (
          <AdminOrganizations
            t={t}
            language={language}
            organizations={organizations.data ?? []}
            detail={orgDetail}
            onMembers={orgMembers}
            onAction={orgAction}
            onMemberAction={call}
            users={users.data ?? []}
            onCreate={(body) =>
              call(
                "/api/admin/organizations",
                { method: "POST", body: JSON.stringify(body) },
                crmText(
                  "Организацијата е креирана и клиентот е поврзан.",
                  "Organisation created and client assigned.",
                  "Organizata u krijua dhe klienti u caktua.",
                ),
              )
            }
          />
        )}
        {(tab === "subscriptions" || tab === "changes") && (
          <AdminSubscriptions
            tab={tab}
            t={t}
            language={language}
            accountChanges={accountChanges}
            users={users}
            organizations={organizations}
            subscriptions={subscriptions}
            invitations={invitations}
            settings={settings}
            selectedSubscriptionUserId={selectedSubscriptionUserId}
            setSelectedSubscriptionUserId={setSelectedSubscriptionUserId}
            selectedSubscriptionUser={selectedSubscriptionUser}
            call={call}
            invite={invite}
            renewSubscription={renewSubscription}
            activate={activate}
            settingValue={settingValue}
            savePaymentInstructions={savePaymentInstructions}
            refresh={refresh}
            setError={setError}
            setScopedSuccess={setScopedSuccess}
          />
        )}
        {tab === "contacts" && (
          <AdminContacts
            t={t}
            dma={dma}
            language={language}
            contacts={contacts}
            staffUsers={staffUsers}
            organizations={organizations}
            contactDetail={contactDetail}
            setContactDetail={setContactDetail}
            crmText={crmText}
            loadContact={loadContact}
            call={call}
            assignContact={assignContact}
            linkContact={linkContact}
            updateContactStatus={updateContactStatus}
            updateContactService={updateContactService}
          />
        )}
        {tab === "tickets" && (
          <AdminTickets
            t={t}
            language={language}
            tickets={tickets.data ?? []}
            users={users.data ?? []}
            organizations={organizations.data ?? []}
            staff={staffUsers.data ?? []}
            initialTicketId={initialTicketId}
            onChanged={refresh}
            onError={setError}
          />
        )}
        {tab === "meetings" && (
          <StaffMeetingsPanel
            meetings={adminMeetings.data ?? []}
            loading={adminMeetings.loading}
            staff={staffUsers.data ?? []}
            canTriage
            canSchedule
            language={language}
            onChanged={refresh}
            onError={setError}
          />
        )}
        {tab === "documents" && (
          <AdminDocuments
            t={t}
            language={language}
            attachments={attachments.data ?? []}
            loading={attachments.loading}
            onPreview={setPreview}
            onDownload={downloadAttachment}
          />
        )}
        {tab === "users" && (
          <AdminUsers
            t={t}
            language={language}
            currentUserId={user?.id}
            users={users.data ?? []}
            roles={Array.from(
              new Set([
                ...(roleDefinitions.data ?? [
                  "Client",
                  "HelpDeskAgent",
                  "Expert",
                  "Admin",
                ]),
                ...newRoles,
              ]),
            )}
            onCreateUser={async (event) => {
              const created = await createUser(event);
              if (created)
                users.setData((current) =>
                  current ? [created, ...current] : [created],
                );
            }}
            onCreateRole={async (event) => {
              const name = await createRole(event);
              if (name)
                setNewRoles((roles) =>
                  roles.includes(name) ? roles : [...roles, name],
                );
            }}
            onAssignRole={async (event, id) => {
              const roleName = await role(event, id);
              if (!roleName) return;
              users.setData(
                (current) =>
                  current?.map((item) =>
                    item.id === id && !item.roles.includes(roleName)
                      ? { ...item, roles: [...item.roles, roleName] }
                      : item,
                  ) ?? null,
              );
            }}
            onRemoveRole={async (id, roleName) => {
              const removed = await removeRole(id, roleName);
              if (removed)
                users.setData(
                  (current) =>
                    current?.map((item) =>
                      item.id === id
                        ? {
                            ...item,
                            roles: item.roles.filter(
                              (currentRole) => currentRole !== roleName,
                            ),
                          }
                        : item,
                    ) ?? null,
                );
              return removed;
            }}
            onStatusChange={toggleUserStatus}
          />
        )}
        {tab === "content" && (
          <AdminContent
            t={t}
            language={language}
            services={serviceContent}
            pages={pageContent}
            onSave={saveContent}
          />
        )}
        {tab === "reports" && (
          <AdminReports
            t={t}
            language={language}
            kpis={kpis.data}
            contacts={contactReport.data}
            tickets={ticketReport.data}
            meetings={meetingReport.data}
            referrals={referralReport.data}
            crmDemand={crmDemandReport.data}
            analytics={crmAnalyticsReport.data}
            users={users.data ?? []}
            onExport={exportReport}
          />
        )}
        {tab === "evidence" && (
          <AdminEvidence
            t={t}
            language={language}
            evidenceView={evidenceView}
            setEvidenceView={setEvidenceView}
            evidenceEntityType={evidenceEntityType}
            setEvidenceEntityType={setEvidenceEntityType}
            evidenceRelatedId={evidenceRelatedId}
            setEvidenceRelatedId={setEvidenceRelatedId}
            showEvidenceTargets={showEvidenceTargets}
            setShowEvidenceTargets={setShowEvidenceTargets}
            evidence={evidence}
            evidenceTemplates={evidenceTemplates}
            evidenceTargets={evidenceTargets}
            uploadEvidence={uploadEvidence}
            downloadEvidence={downloadEvidence}
            downloadTemplate={downloadTemplate}
            onClearError={() => setScopedError(null)}
          />
        )}
        {tab === "settings" && (
          <AdminSettings
            t={t}
            language={language}
            settings={settings.data ?? []}
            onSave={saveSetting}
          />
        )}
        {tab === "notifications" && (
          <AdminNotifications
            language={language}
            notifications={notifications.data ?? []}
            users={users.data ?? []}
            retryingId={retryingNotificationId}
            onRetry={retryNotification}
          />
        )}
        {tab === "audit" && (
          <AdminAudit t={t} language={language} audits={audits.data ?? []} />
        )}
        {preview && (
          <DocumentPreview
            document={preview}
            onClose={() => setPreview(undefined)}
          />
        )}
      </div>
    </section>
  );
}
