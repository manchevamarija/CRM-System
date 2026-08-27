import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  Contact,
  CrmServiceItem,
  Organization,
  StaffUser,
} from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";
import { AdminContactDetail } from "./AdminContactDetail";

type Resource<T> = { data: T[] | null; loading: boolean };
type Call = (
  path: string,
  options?: RequestInit,
  successMessage?: string,
) => Promise<boolean>;
type Props = {
  t: ReturnType<typeof workspaceCopy>;
  dma: Record<string, string>;
  language: Language;
  contacts: Resource<Contact>;
  staffUsers: Resource<StaffUser>;
  organizations: Resource<Organization>;
  contactDetail: Contact | null;
  setContactDetail: Dispatch<SetStateAction<Contact | null>>;
  crmText: (mk: string, en: string, sq: string) => string;
  loadContact: (id: string) => Promise<void>;
  call: Call;
  assignContact: (
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) => Promise<void>;
  linkContact: (event: FormEvent<HTMLFormElement>, id: string) => Promise<void>;
  updateContactStatus: (contact: Contact, status: string) => Promise<void>;
  updateContactService: (
    event: FormEvent<HTMLFormElement>,
    contact: Contact,
    service: CrmServiceItem,
  ) => Promise<void>;
};

export function AdminContacts(props: Props) {
  const {
    t,
    dma,
    language,
    contacts,
    staffUsers,
    organizations,
    contactDetail,
    setContactDetail,
    crmText,
    loadContact,
    call,
    assignContact,
    linkContact,
    updateContactStatus,
    updateContactService,
  } = props;
  return (
    <div className="ticket-list">
      <div className="list-head">
        <h2>DMA {t.contactRequests}</h2>
      </div>
      {(contacts.data ?? []).map((item) => (
        <div className="approval contact-request-card" key={item.id}>
          <button
            type="button"
            className="contact-request-summary"
            onClick={() => void loadContact(item.id)}
          >
            <b>{item.organizationName}</b>
            <small>
              {item.contactName} · {item.email} ·{" "}
              {item.requestType === "Partnership"
                ? "Соработка"
                : "Консултација"}{" "}
              · {labelFor(item.status, language)}
            </small>
            <span className="contact-request-open-label">
              {language === "mk"
                ? "Отвори"
                : language === "sq"
                  ? "Hap"
                  : "Open"}
            </span>
          </button>
          <div className="contact-request-actions" hidden>
            <button
              className="secondary"
              onClick={() => void loadContact(item.id)}
            >
              {t.details}
            </button>
            {item.status !== "Handled" && (
              <button
                className="approve"
                onClick={() =>
                  call(`/api/admin/contact-requests/${item.id}/mark-handled`)
                }
              >
                {t.handled}
              </button>
            )}
            <form
              className="inline-form"
              onSubmit={(event) => assignContact(event, item.id)}
            >
              <select
                name="userId"
                required
                defaultValue={item.assignedTo ?? ""}
              >
                <option value="">
                  {language === "en"
                    ? "Assign staff"
                    : language === "sq"
                      ? "Cakto stafin"
                      : "Додели на staff"}
                </option>
                {(staffUsers.data ?? []).map((staffUser) => (
                  <option
                    key={`${staffUser.id}-${staffUser.role}`}
                    value={staffUser.id}
                  >
                    {staffUser.email} · {labelFor(staffUser.role, language)}
                  </option>
                ))}
              </select>
              <button>{t.assign}</button>
            </form>
            <form
              className="inline-form"
              onSubmit={(event) => linkContact(event, item.id)}
            >
              <select
                name="organizationId"
                required
                defaultValue={item.linkedOrganizationId ?? ""}
              >
                <option value="">
                  {language === "en"
                    ? "Link organisation"
                    : language === "sq"
                      ? "Lidh organizatën"
                      : "Поврзи организација"}
                </option>
                {(organizations.data ?? [])
                  .filter((organization) => organization.status === "Approved")
                  .map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
              </select>
              <button>
                {language === "en"
                  ? "Link"
                  : language === "sq"
                    ? "Lidh"
                    : "Поврзи"}
              </button>
            </form>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void call(`/api/admin/contact-requests/${item.id}/respond`, {
                  method: "POST",
                  body: JSON.stringify({ body: data.get("body") }),
                });
              }}
            >
              <input name="body" required placeholder={t.emailReply} />
              <button className="approve">{t.send}</button>
            </form>
          </div>
        </div>
      ))}
      {!contacts.loading && !(contacts.data ?? []).length && (
        <div className="empty-state">
          <h3>{t.noContactRequests}</h3>
          <p>{t.noContactRequestsHelp}</p>
        </div>
      )}
      {contactDetail && (
        <AdminContactDetail
          t={t}
          dma={dma}
          language={language}
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
    </div>
  );
}
