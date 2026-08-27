import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { api } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  Contact,
  CrmServiceItem,
  Organization,
  StaffUser,
  TenantDescriptor,
  ContactRequestTransfer,
} from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";
import {
  crmServiceCatalog,
  serviceLabel,
} from "../../../shared/serviceCatalog";
import { AdminContactMetadata } from "./AdminContactMetadata";
import { ContactRequestDocuments } from "./ContactRequestDocuments";

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
  staffUsers: Resource<StaffUser>;
  organizations: Resource<Organization>;
  contactDetail: Contact;
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

export function AdminContactDetail(props: Props) {
  const {
    t,
    dma,
    language,
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
  const agents = (staffUsers.data ?? []).filter(
    (user) => user.role === "Admin" || user.role === "HelpDeskAgent",
  );
  const advisors = (staffUsers.data ?? []).filter(
    (user) => user.role === "HelpDeskAgent",
  );
  const experts = (staffUsers.data ?? []).filter(
    (user) => user.role === "Expert",
  );
  const [tenants, setTenants] = useState<TenantDescriptor[]>([]);
  const [transfers, setTransfers] = useState<ContactRequestTransfer[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<TenantDescriptor[]>("/api/admin/contact-requests/tenants"),
      api<ContactRequestTransfer[]>(
        `/api/admin/contact-requests/${contactDetail.id}/transfers`,
      ),
    ])
      .then(([tenantItems, transferItems]) => {
        if (!active) return;
        setTenants(tenantItems);
        setTransfers(transferItems);
      })
      .catch(() => {
        if (!active) return;
        setTenants([]);
        setTransfers([]);
      });
    return () => {
      active = false;
    };
  }, [contactDetail.id, contactDetail.ownerTenantId]);
  const tenantName = (id: string) =>
    tenants.find((tenant) => tenant.id === id)?.name ?? id.toUpperCase();
  return (
    <div
      className="contact-request-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setContactDetail(null);
        }
      }}
    >
      <section
        className="workspace organization-detail contact-request-detail"
        role="dialog"
        aria-modal="true"
        aria-label={contactDetail.organizationName}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="back-link" onClick={() => setContactDetail(null)}>
          × {t.close}
        </button>
        <span className="kicker contact-dma-label">{t.dmaContactRequest}</span>
        <h2>{contactDetail.organizationName}</h2>
        <div className="crm-admin-status">
          <div>
            <span>{crmText("CRM статус", "CRM status", "Statusi CRM")}</span>
            <strong>{labelFor(contactDetail.status, language)}</strong>
          </div>
          <select
            value={contactDetail.status}
            onChange={(event) =>
              void updateContactStatus(contactDetail, event.target.value)
            }
          >
            <option value="Applied">
              {crmText("Пријавен", "Applied", "Aplikuar")}
            </option>
            <option value="Contacting">
              {crmText("Во фаза на контактирање", "Contacting", "Në kontaktim")}
            </option>
            <option value="Assigned">
              {crmText(
                "Доделен на агент од CRM System",
                "Assigned to a CRM System agent",
                "Caktuar një agjenti CRM System",
              )}
            </option>
            <option value="ServicesConfirmed">
              {crmText(
                "Потврдени услуги",
                "Services confirmed",
                "Shërbimet e konfirmuara",
              )}
            </option>
            <option value="InService">
              {crmText(
                "Во процедура на услуга",
                "Service in progress",
                "Shërbimi në proces",
              )}
            </option>
            <option value="FollowUp">Follow up</option>
            <option value="Served">
              {crmText("Услужен", "Served", "I shërbyer")}
            </option>
          </select>
        </div>
        <div className="crm-timeline admin-timeline">
          {[
            "Applied",
            "Contacting",
            "Assigned",
            "ServicesConfirmed",
            "InService",
            "FollowUp",
            "Served",
          ].map((status, index, all) => {
            const current = all.indexOf(contactDetail.status);
            return (
              <div className={index <= current ? "active" : ""} key={status}>
                <i>{index < current ? "✓" : index + 1}</i>
                <span>{labelFor(status, language)}</span>
              </div>
            );
          })}
        </div>
        <section className="contact-detail-actions">
          <div className="contact-action-group contact-status-actions">
            <span className="contact-action-label">
              {language === "mk"
                ? "Статус на барањето"
                : language === "sq"
                  ? "Statusi i kërkesës"
                  : "Request status"}
            </span>
            <div className="contact-action-buttons">
              {contactDetail.status !== "Handled" && (
                <button
                  className="approve"
                  onClick={() =>
                    call(
                      `/api/admin/contact-requests/${contactDetail.id}/mark-handled`,
                    )
                  }
                >
                  {t.handled}
                </button>
              )}
            </div>
          </div>
          <div className="contact-action-group contact-assignment-group">
            <span className="contact-action-label">
              {language === "mk"
                ? "Додели одговорен"
                : language === "sq"
                  ? "Cakto përgjegjësin"
                  : "Assign owner"}
            </span>
            <form
              className="contact-assignment-form"
              onSubmit={(event) => assignContact(event, contactDetail.id)}
            >
              <label>
                <span>{language === "mk" ? "Агент" : "Agent"}</span>
                <select
                  name="agentId"
                  required
                  defaultValue={contactDetail.assignedTo ?? ""}
                >
                  <option value="">
                    {language === "mk" ? "Избери агент" : "Select agent"}
                  </option>
                  {agents.map((staffUser) => (
                    <option key={staffUser.id} value={staffUser.id}>
                      {staffUser.email} · {labelFor(staffUser.role, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  {language === "mk"
                    ? "Help-desk советник (опционално)"
                    : "Help-desk advisor (optional)"}
                </span>
                <select
                  name="helpDeskAdvisorId"
                  defaultValue={contactDetail.assignedHelpDeskAdvisorId ?? ""}
                >
                  <option value="">
                    {language === "mk" ? "Без советник" : "No advisor"}
                  </option>
                  {advisors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  {language === "mk"
                    ? "Експерт (опционално)"
                    : "Expert (optional)"}
                </span>
                <select
                  name="expertId"
                  defaultValue={contactDetail.assignedExpertId ?? ""}
                >
                  <option value="">
                    {language === "mk" ? "Без експерт" : "No expert"}
                  </option>
                  {experts.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="contact-assignment-submit">
                <span aria-hidden="true">&nbsp;</span>
                <button className="primary">{t.assign}</button>
              </div>
            </form>
          </div>
          <div className="contact-action-group">
            <span className="contact-action-label">
              {language === "mk"
                ? "Поврзи со организација"
                : language === "sq"
                  ? "Lidh me organizatën"
                  : "Link to organisation"}
            </span>
            <form
              className="inline-form"
              onSubmit={(event) => linkContact(event, contactDetail.id)}
            >
              <select
                name="organizationId"
                required
                defaultValue={contactDetail.linkedOrganizationId ?? ""}
              >
                <option value="">{t.organization}</option>
                {(organizations.data ?? [])
                  .filter((item) => item.status === "Approved")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <button className="primary">
                {language === "mk" ? "Поврзи" : "Link"}
              </button>
            </form>
          </div>
          <div className="contact-action-group contact-handover-group">
            <span className="contact-action-label">
              {crmText(
                "Примопредавање меѓу центри",
                "Handover between centres",
                "Dorëzim ndërmjet qendrave",
              )}
            </span>
            <div className="contact-ownership-summary">
              <span>
                {crmText("Креирано преку", "Created through", "Krijuar përmes")}
                : {tenantName(contactDetail.createdTenantId)}
              </span>
              <strong>
                {crmText(
                  "Одговорен центар",
                  "Responsible centre",
                  "Qendra përgjegjëse",
                )}
                : {tenantName(contactDetail.ownerTenantId)}
              </strong>
            </div>
            <form
              className="contact-handover-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const ok = await call(
                  `/api/admin/contact-requests/${contactDetail.id}/transfer`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      destinationTenantId: data.get("destinationTenantId"),
                      reason: data.get("reason"),
                    }),
                  },
                  crmText(
                    "Барањето е предадено без да се отвори ново.",
                    "The request was handed over without creating a new one.",
                    "Kërkesa u dorëzua pa krijuar një të re.",
                  ),
                );
                if (ok) {
                  form.reset();
                  await loadContact(contactDetail.id);
                }
              }}
            >
              <select name="destinationTenantId" required defaultValue="">
                <option value="" disabled>
                  {crmText(
                    "Избери нов центар",
                    "Select new centre",
                    "Zgjidh qendrën e re",
                  )}
                </option>
                {tenants
                  .filter((tenant) => tenant.id !== contactDetail.ownerTenantId)
                  .map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
              </select>
              <input
                name="reason"
                required
                placeholder={crmText(
                  "Причина за примопредавање",
                  "Reason for handover",
                  "Arsyeja e dorëzimit",
                )}
              />
              <button className="primary">
                {crmText(
                  "Предади барање",
                  "Hand over request",
                  "Dorëzo kërkesën",
                )}
              </button>
            </form>
            {transfers.length > 0 && (
              <div className="contact-transfer-history">
                {transfers.map((transfer) => (
                  <div key={transfer.id}>
                    <b>
                      {tenantName(transfer.fromTenantId)} →{" "}
                      {tenantName(transfer.toTenantId)}
                    </b>
                    <span>{transfer.reason}</span>
                    <time>
                      {new Date(transfer.transferredAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ContactRequestDocuments
            contactRequestId={contactDetail.id}
            language={language}
          />
          <div className="contact-action-group contact-action-wide">
            <span className="contact-action-label">
              {language === "mk"
                ? "Одговори по е-пошта до подносителот"
                : language === "sq"
                  ? "Përgjigju me email dërguesit"
                  : "Reply by email to the submitter"}
            </span>
            <form
              className="inline-form contact-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void call(
                  `/api/admin/contact-requests/${contactDetail.id}/respond`,
                  {
                    method: "POST",
                    body: JSON.stringify({ body: data.get("body") }),
                  },
                );
              }}
            >
              <input name="body" required placeholder={t.emailReply} />
              <button className="approve">{t.send}</button>
            </form>
          </div>
        </section>
        <section className="admin-crm-services">
          <div className="list-head">
            <div>
              <h3>
                {crmText(
                  "Услуги на клиентот",
                  "Client services",
                  "Shërbimet e klientit",
                )}
              </h3>
              <p>
                {crmText(
                  "Поставете статус, цена, рок и одговорен агент за секоја услуга.",
                  "Set a status, price, deadline and responsible agent for each service.",
                  "Vendosni statusin, çmimin, afatin dhe agjentin përgjegjës për çdo shërbim.",
                )}
              </p>
            </div>
          </div>
          <form
            className="admin-add-service"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const name = String(new FormData(form).get("name") ?? "").trim();
              const ok = await call(
                `/api/admin/contact-requests/${contactDetail.id}/services`,
                { method: "POST", body: JSON.stringify({ name }) },
                crmText(
                  "Услугата е додадена.",
                  "Service added.",
                  "Shërbimi u shtua.",
                ),
              );
              if (ok) {
                form.reset();
                await loadContact(contactDetail.id);
              }
            }}
          >
            <div>
              <b>{crmText("Додади услуга", "Add service", "Shto shërbim")}</b>
              <small>
                {crmText(
                  "Изберете од каталогот на услуги",
                  "Select from the service catalogue",
                  "Zgjidhni nga katalogu i shërbimeve",
                )}
              </small>
            </div>
            <select name="name" required defaultValue="">
              <option value="" disabled>
                {crmText(
                  "Изберете услуга",
                  "Select a service",
                  "Zgjidhni shërbimin",
                )}
              </option>
              {crmServiceCatalog
                .filter(
                  (option) =>
                    !(() => {
                      try {
                        return (
                          JSON.parse(
                            contactDetail.serviceItemsJson || "[]",
                          ) as CrmServiceItem[]
                        ).some((service) => service.name === option.value);
                      } catch {
                        return false;
                      }
                    })(),
                )
                .map((option) => (
                  <option value={option.value} key={option.value}>
                    {serviceLabel(option, language)}
                  </option>
                ))}
            </select>
            <button className="primary">
              {crmText("Додади", "Add", "Shto")}
            </button>
          </form>
          {(() => {
            try {
              return JSON.parse(
                contactDetail.serviceItemsJson || "[]",
              ) as CrmServiceItem[];
            } catch {
              return [];
            }
          })().map((service) => (
            <form
              className="admin-service-card"
              key={service.id}
              onSubmit={(event) =>
                updateContactService(event, contactDetail, service)
              }
            >
              <div className="admin-service-card-head">
                <span>CRM SERVICE</span>
                <b>{service.name}</b>
                <small>
                  {crmText(
                    "Промените на услугата автоматски ја придвижуваат CRM фазата.",
                    "Service updates automatically advance the CRM stage.",
                    "Përditësimet e shërbimit avancojnë automatikisht fazën CRM.",
                  )}
                </small>
              </div>
              <label>
                <span>{crmText("Статус", "Status", "Statusi")}</span>
                <select name="status" defaultValue={service.status}>
                  <option value="Selected">
                    {crmText("Избрана", "Selected", "E zgjedhur")}
                  </option>
                  <option value="Confirmed">
                    {crmText("Потврдена", "Confirmed", "E konfirmuar")}
                  </option>
                  <option value="InProgress">
                    {crmText("Во процедура", "In progress", "Në proces")}
                  </option>
                  <option value="FollowUp">Follow up</option>
                  <option value="Completed">
                    {crmText("Завршена", "Completed", "E përfunduar")}
                  </option>
                </select>
              </label>
              <label>
                <span>{crmText("Цена", "Price", "Çmimi")}</span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={service.price}
                  placeholder="0.00 €"
                />
              </label>
              <label>
                <span>{crmText("Рок", "Deadline", "Afati")}</span>
                <input
                  name="deadline"
                  type="date"
                  defaultValue={service.deadline?.slice(0, 10)}
                />
              </label>
              <label>
                <span>
                  {crmText(
                    "Одговорен агент",
                    "Responsible agent",
                    "Agjenti përgjegjës",
                  )}
                </span>
                <select
                  name="assignedAgentId"
                  defaultValue={service.assignedAgentId ?? ""}
                >
                  <option value="">
                    {crmText("Избери агент", "Select agent", "Zgjidh agjentin")}
                  </option>
                  {(staffUsers.data ?? []).map((agent) => (
                    <option value={agent.id} key={`${service.id}-${agent.id}`}>
                      {agent.email}
                    </option>
                  ))}
                </select>
              </label>
              <button className="approve">
                {crmText("Зачувај промени", "Save changes", "Ruaj ndryshimet")}
              </button>
              <button
                className="admin-service-remove"
                type="button"
                title={crmText(
                  "Отстрани услуга",
                  "Remove service",
                  "Hiq shërbimin",
                )}
                onClick={async () => {
                  if (
                    !window.confirm(
                      crmText(
                        `Да се отстрани „${service.name}“?`,
                        `Remove “${service.name}”?`,
                        `Të hiqet “${service.name}”?`,
                      ),
                    )
                  )
                    return;
                  const ok = await call(
                    `/api/admin/contact-requests/${contactDetail.id}/services/${service.id}`,
                    { method: "DELETE" },
                    crmText(
                      "Услугата е отстранета.",
                      "Service removed.",
                      "Shërbimi u hoq.",
                    ),
                  );
                  if (ok) await loadContact(contactDetail.id);
                }}
              >
                ×
              </button>
            </form>
          ))}
        </section>
        <AdminContactMetadata
          contact={contactDetail}
          dma={dma}
          language={language}
          statusLabel={t.status}
          categoryLabel={t.dmaCategory}
        />
      </section>
    </div>
  );
}
