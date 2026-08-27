import type { workspaceCopy } from "../../content/workspaceCopy";
import type { Language } from "../../shared/types";
import type { Contact, CrmServiceItem } from "./adminModels";
import type { Tab } from "./AdminDashboardPage";

export function buildAdminMenu(
  t: ReturnType<typeof workspaceCopy>,
  language: Language,
): { key: Tab; label: string }[] {
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  return [
    { key: "overview", label: t.overview },
    {
      key: "myNotifications",
      label: text("Известувања", "Notifications", "Njoftimet"),
    },
    { key: "tickets", label: t.tickets },
    { key: "meetings", label: text("Состаноци", "Meetings", "Takimet") },
    { key: "organizations", label: t.organizations },
    {
      key: "changes",
      label: text(
        "Барања за промена",
        "Change requests",
        "Kërkesa për ndryshim",
      ),
    },
    { key: "subscriptions", label: t.subscriptions },
    { key: "contacts", label: t.contacts },
    { key: "documents", label: t.documents },
    { key: "users", label: t.users },
    { key: "content", label: t.content },
    { key: "reports", label: t.reports },
    {
      key: "evidence",
      label: text(
        "KPI документација",
        "KPI documentation",
        "Dokumentacioni KPI",
      ),
    },
    { key: "settings", label: t.settings },
    {
      key: "notifications",
      label: text(
        "Испраќање е-пораки",
        "Email delivery",
        "Dërgimi i email-eve",
      ),
    },
    { key: "audit", label: t.audit },
  ];
}

export function calculateCrmMetrics(contacts: Contact[]) {
  const statusOrder = [
    "Applied",
    "Contacting",
    "Assigned",
    "ServicesConfirmed",
    "InService",
    "FollowUp",
    "Served",
  ];
  const statusCounts = Object.fromEntries(
    statusOrder.map((status) => [
      status,
      contacts.filter((item) => item.status === status).length,
    ]),
  ) as Record<string, number>;
  const activeClients = contacts.filter(
    (item) => item.status !== "Served",
  ).length;
  const assignedAgents = new Set(
    contacts.map((item) => item.assignedTo).filter(Boolean),
  ).size;
  const totalValue = contacts.reduce(
    (sum, item) => sum + serviceValue(item.serviceItemsJson),
    0,
  );
  return {
    statusOrder,
    statusCounts,
    activeClients,
    assignedAgents,
    totalValue,
  };
}

function serviceValue(json: string) {
  try {
    return (JSON.parse(json || "[]") as CrmServiceItem[]).reduce(
      (sum, service) => sum + (service.price ?? 0),
      0,
    );
  } catch {
    return 0;
  }
}
