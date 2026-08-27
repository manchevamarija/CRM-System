import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { api, ApiError } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { Language } from "../../../shared/types";
import type { Tab } from "../AdminDashboardPage";
import type {
  Contact,
  CrmServiceItem,
  OrgDetail,
  Subscription,
  User,
} from "../adminModels";
import { useAdminDownloads } from "./useAdminDownloads";

type ScopedMessage = { tab: Tab; message: string } | null;
type Props = {
  language: Language;
  t: ReturnType<typeof workspaceCopy>;
  tab: Tab;
  initialOrganizationId?: string;
  refresh: () => void;
  setError: (message: string) => void;
  setScopedError: Dispatch<SetStateAction<ScopedMessage>>;
  setScopedSuccess: Dispatch<SetStateAction<ScopedMessage>>;
  setRetryingNotificationId: Dispatch<SetStateAction<string | undefined>>;
  setOrgDetail: Dispatch<SetStateAction<OrgDetail | null>>;
  setContactDetail: Dispatch<SetStateAction<Contact | null>>;
  setEvidenceRelatedId: Dispatch<SetStateAction<string>>;
  setShowEvidenceTargets: Dispatch<SetStateAction<boolean>>;
  setEvidenceView: Dispatch<
    SetStateAction<"upload" | "templates" | "register">
  >;
};

export function useAdminCommands(props: Props) {
  const {
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
  } = props;
  const {
    exportReport,
    downloadEvidence,
    downloadAttachment,
    downloadTemplate,
  } = useAdminDownloads({ t, setError });
  const call = async (
    path: string,
    options: RequestInit = { method: "POST" },
    successMessage?: string,
  ) => {
    try {
      await api(path, options);
      setScopedError(null);
      setScopedSuccess(
        successMessage ? { tab, message: successMessage } : null,
      );
      refresh();
      return true;
    } catch (reason) {
      const activeSubscription =
        language === "en"
          ? "This user already has an active subscription. No new invitation is needed."
          : language === "sq"
            ? "Ky përdorues tashmë ka një abonim aktiv. Nuk nevojitet ftesë e re."
            : "Овој корисник веќе има активна претплата. Не е потребна нова покана.";
      const organizationMismatch =
        language === "mk"
          ? "Изберете ја одобрената организација на која припаѓа корисникот."
          : language === "sq"
            ? "Zgjidhni organizatën e miratuar të lidhur me këtë përdorues."
            : "Select the approved organization assigned to this user.";
      const evidenceTemplateMismatch =
        language === "mk"
          ? "Избраниот образец не одговара на поврзаниот тип. Изберете образец од прикажаната листа."
          : language === "sq"
            ? "Modeli i zgjedhur nuk përputhet me llojin e lidhur. Zgjidhni model nga lista."
            : "The selected template does not match the related type. Choose a template from the displayed list.";
      setError(
        reason instanceof ApiError &&
          tab === "subscriptions" &&
          reason.status === 409
          ? activeSubscription
          : reason instanceof ApiError &&
              tab === "subscriptions" &&
              reason.status === 400
            ? organizationMismatch
            : reason instanceof ApiError &&
                tab === "evidence" &&
                reason.message.includes("template does not match")
              ? evidenceTemplateMismatch
              : reason instanceof Error
                ? reason.message
                : t.actionError,
      );
      setScopedSuccess(null);
      return false;
    }
  };
  const retryNotification = async (id: string) => {
    setRetryingNotificationId(id);
    const message =
      language === "en"
        ? "Retry queued. Delivery will start when SMTP is configured."
        : language === "sq"
          ? "Riprovimi u vendos në radhë. Dërgimi do të fillojë kur të konfigurohet SMTP."
          : "Повторното испраќање е закажано. Испораката ќе започне кога ќе се конфигурира SMTP.";
    await call(
      `/api/admin/notifications/${id}/retry`,
      { method: "POST" },
      message,
    );
    setRetryingNotificationId(undefined);
  };
  const orgAction = (id: string, action: string) =>
    call(`/api/admin/organizations/${id}/${action}`);
  const orgMembers = async (id: string) => {
    try {
      setOrgDetail(await api<OrgDetail>(`/api/admin/organizations/${id}`));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t.loadOrganizationError,
      );
    }
  };
  const [openedInitialOrganizationId, setOpenedInitialOrganizationId] =
    useState<string>();
  useEffect(() => {
    if (
      !initialOrganizationId ||
      openedInitialOrganizationId === initialOrganizationId ||
      tab !== "organizations"
    )
      return;
    setOpenedInitialOrganizationId(initialOrganizationId);
    orgMembers(initialOrganizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrganizationId, openedInitialOrganizationId, tab]);
  const loadContact = async (id: string) => {
    try {
      setContactDetail(await api<Contact>(`/api/admin/contact-requests/${id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.actionError);
    }
  };
  const updateContactStatus = async (contact: Contact, status: string) => {
    try {
      const updated = await api<Contact>(
        `/api/admin/contact-requests/${contact.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            assignedTo: contact.assignedTo ?? null,
            linkedOrganizationId: contact.linkedOrganizationId ?? null,
            dmaCategory: contact.dmaCategory,
            internalNote: contact.internalNote ?? null,
          }),
        },
      );
      setContactDetail(updated);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Статусот не можеше да се промени.",
      );
    }
  };
  const updateContactService = async (
    event: FormEvent<HTMLFormElement>,
    contact: Contact,
    service: CrmServiceItem,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const updated = await api<Contact>(
        `/api/admin/contact-requests/${contact.id}/services/${service.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: data.get("status"),
            price: data.get("price") ? Number(data.get("price")) : null,
            deadline: data.get("deadline") || null,
            assignedAgentId: data.get("assignedAgentId") || null,
          }),
        },
      );
      setContactDetail(updated);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Услугата не можеше да се ажурира.",
      );
    }
  };
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await call("/api/admin/subscription-invitations", {
      method: "POST",
      body: JSON.stringify({
        userId: data.get("userId"),
        organizationId: data.get("organizationId"),
      }),
    });
    form.reset();
  };
  const renewSubscription = (subscription: Subscription) =>
    call(
      "/api/admin/subscription-invitations",
      {
        method: "POST",
        body: JSON.stringify({
          userId: subscription.userId,
          organizationId: subscription.organizationId,
        }),
      },
      language === "en"
        ? "A new subscription invitation was created."
        : language === "sq"
          ? "U krijua një ftesë e re për abonim."
          : "Креирана е нова покана за претплата.",
    );
  const activate = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await call(`/api/admin/subscriptions/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({
        paymentReference: data.get("paymentReference"),
        paymentNote: data.get("paymentNote"),
      }),
    });
  };
  const role = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roleName = String(data.get("role") ?? "");
    const added = await call(`/api/admin/users/${id}/roles`, {
      method: "POST",
      body: JSON.stringify({ roles: [roleName] }),
    });
    return added ? roleName : undefined;
  };
  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await api<User>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          phone: data.get("phone") || null,
          role: data.get("role"),
          preferredLanguage: language,
        }),
      });
      form.reset();
      setScopedError(null);
      setScopedSuccess({
        tab,
        message:
          language === "en"
            ? "The user was created and the temporary password was emailed."
            : language === "sq"
              ? "Përdoruesi u krijua dhe fjalëkalimi i përkohshëm u dërgua me email."
              : "Корисникот е креиран, а привремената лозинка е испратена по е-пошта.",
      });
      refresh();
      return created;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.actionError);
    }
  };
  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    const created = await call(
      "/api/admin/users/roles",
      { method: "POST", body: JSON.stringify({ name }) },
      "Новата улога е креирана.",
    );
    if (!created) return;
    form.reset();
    return name;
  };
  const removeRole = (id: string, roleName: string) =>
    call(`/api/admin/users/${id}/roles/${encodeURIComponent(roleName)}`, {
      method: "DELETE",
    });
  const toggleUserStatus = (item: User) =>
    call(`/api/admin/users/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: item.status === "Active" ? "Inactive" : "Active",
        preferredLanguage: item.preferredLanguage,
        phone: item.phoneNumber,
      }),
    });
  const assignContact = async (
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const agentId = String(data.get("agentId") ?? "");
    const optionalId = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value || null;
    };
    await call(`/api/admin/contact-requests/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({
        agentId,
        helpDeskAdvisorId: optionalId("helpDeskAdvisorId"),
        expertId: optionalId("expertId"),
      }),
    });
  };
  const linkContact = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const organizationId = new FormData(event.currentTarget).get(
      "organizationId",
    );
    await call(
      `/api/admin/contact-requests/${id}/link-organization?organizationId=${encodeURIComponent(String(organizationId))}`,
    );
  };
  const saveContent = async (
    event: FormEvent<HTMLFormElement>,
    kind: "services" | "pages",
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("contentTitle") ?? "").trim();
    const description = String(data.get("contentDescription") ?? "").trim();
    const sharedTranslation = { title, description };
    const successMessage =
      language === "en"
        ? "Content saved for all three languages."
        : language === "sq"
          ? "Përmbajtja u ruajt për të tri gjuhët."
          : "Содржината е зачувана на сите три јазици.";
    return call(
      `/api/admin/${kind}`,
      {
        method: "POST",
        body: JSON.stringify({
          slug: String(data.get("slug") ?? "").trim(),
          status: data.get("status"),
          category:
            String(data.get("category") ?? "General").trim() || "General",
          translations: {
            mk: sharedTranslation,
            en: sharedTranslation,
            sq: sharedTranslation,
          },
        }),
      },
      successMessage,
    );
  };
  const saveSetting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await call(`/api/admin/settings/${data.get("key")}`, {
      method: "PUT",
      body: JSON.stringify({
        value: data.get("value"),
        description: data.get("description"),
      }),
    });
  };
  const savePaymentInstructions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = [
      "PAYMENT_RECIPIENT",
      "PAYMENT_BANK",
      "PAYMENT_ACCOUNT",
      "PAYMENT_IBAN",
      "PAYMENT_SWIFT",
      "PAYMENT_AMOUNT",
      "PAYMENT_CURRENCY",
      "PAYMENT_PURPOSE",
      "PAYMENT_REFERENCE_INSTRUCTION",
      "PAYMENT_SUPPORT_EMAIL",
    ];
    try {
      await Promise.all(
        fields.map((key) =>
          api(`/api/admin/settings/${key}`, {
            method: "PUT",
            body: JSON.stringify({
              value: String(data.get(key) ?? "").trim(),
              description: "Offline subscription payment instruction",
            }),
          }),
        ),
      );
      setScopedError(null);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.actionError);
    }
  };
  const uploadEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File)) return setError(t.chooseEvidenceFile);
    const relatedEntityId = String(data.get("relatedEntityId") ?? "").trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        relatedEntityId,
      )
    ) {
      return setError(
        language === "mk"
          ? "Поврзаниот ID мора да биде валиден системски UUID, а не реден број."
          : language === "sq"
            ? "ID-ja e lidhur duhet të jetë UUID valide e sistemit, jo numër rendor."
            : "The related ID must be a valid system UUID, not a sequence number.",
      );
    }
    const upload = new FormData();
    upload.append("file", file);
    const query = new URLSearchParams({
      relatedEntityType: String(data.get("relatedEntityType")),
      relatedEntityId,
    });
    for (const key of [
      "kpiCategory",
      "reportingPeriod",
      "templateType",
    ] as const) {
      const value = String(data.get(key) ?? "").trim();
      if (value) query.set(key, value);
    }
    const templateId = String(data.get("templateId") ?? "").trim();
    if (templateId) query.set("templateId", templateId);
    await call(`/api/admin/evidence?${query}`, {
      method: "POST",
      body: upload,
    });
    form.reset();
    setEvidenceRelatedId("");
    setShowEvidenceTargets(false);
    setEvidenceView("register");
  };
  return {
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
  };
}
