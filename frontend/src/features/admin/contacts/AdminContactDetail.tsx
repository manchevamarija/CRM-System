import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { api } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  Contact,
  ContactActivity,
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
  const [activity, setActivity] = useState<ContactActivity[]>([]);
  const loadActivity = async () => {
    setActivity(
      await api<ContactActivity[]>(
        `/api/admin/contact-requests/${contactDetail.id}/activity`,
      ),
    );
  };
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api<TenantDescriptor[]>("/api/admin/contact-requests/tenants"),
      api<ContactRequestTransfer[]>(
        `/api/admin/contact-requests/${contactDetail.id}/transfers`,
      ),
      api<ContactActivity[]>(
        `/api/admin/contact-requests/${contactDetail.id}/activity`,
      ),
    ]).then(([tenantsResult, transfersResult, activityResult]) => {
      if (!active) return;
      // A failure in one of these three (e.g. transfers or activity) must not wipe
      // out the others — each is independent, so only reset the one that actually failed.
      setTenants(tenantsResult.status === "fulfilled" ? tenantsResult.value : []);
      setTransfers(transfersResult.status === "fulfilled" ? transfersResult.value : []);
      setActivity(activityResult.status === "fulfilled" ? activityResult.value : []);
    });
    return () => {
      active = false;
    };
  }, [contactDetail.id, contactDetail.ownerTenantId]);
  const tenantName = (id: string) =>
    tenants.find((tenant) => tenant.id === id)?.name ?? id.toUpperCase();

  const approveTransfer = async (transferId: string, decision: "approve" | "reject") => {
    const ok = await call(
      `/api/admin/contact-requests/${contactDetail.id}/transfer/${transferId}/approve`,
      { method: "POST", body: JSON.stringify({ decision }) },
      crmText(
        decision === "approve" ? "Одлуката е евидентирана." : "Примопредавањето е одбиено.",
        decision === "approve" ? "Approval recorded." : "The handover was rejected.",
        decision === "approve" ? "Miratimi u regjistrua." : "Dorëzimi u refuzua.",
      ),
    );
    if (ok) await loadContact(contactDetail.id);
  };
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
        {contactDetail.affiliateCode && (
          <section className="affiliate-contact-banner">
            <span className="kicker">AFFILIATE MARKETING</span>
            <strong>{contactDetail.affiliateCode.toUpperCase()}</strong>
            <small>Ова барање пристигна преку affiliate линк.</small>
            {contactDetail.affiliateClickId && (
              <code>Click ID: {contactDetail.affiliateClickId}</code>
            )}
            {contactDetail.sourceTenantId && (
              <small>Source tenant: {contactDetail.sourceTenantId.toUpperCase()}</small>
            )}
          </section>
        )}
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
                "Доделен на агент од One Stop Shop Portal",
                "Assigned to a One Stop Shop Portal agent",
                "Caktuar një agjenti One Stop Shop Portal",
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
          <div className="contact-action-group contact-status-actions">
            <span className="contact-action-label">
              {language === "mk"
                ? "Профил на клиентот"
                : language === "sq"
                  ? "Profili i klientit"
                  : "Client profile"}
            </span>
            <div className="contact-action-buttons">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  call(
                    `/api/admin/contact-requests/${contactDetail.id}/invite-registration`,
                  )
                }
              >
                {language === "mk"
                  ? "Испрати мejл за регистрација"
                  : language === "sq"
                    ? "Dërgo email për regjistrim"
                    : "Send registration email"}
              </button>
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
              onSubmit={async (event) => {
                await assignContact(event, contactDetail.id);
                await loadActivity();
              }}
            >
              <label>
                <span>
                  {crmText(
                    "Одговорен член на тим",
                    "Team owner",
                    "Përgjegjës i ekipit",
                  )}
                </span>
                <select
                  name="agentId"
                  required
                  defaultValue={contactDetail.assignedTo ?? ""}
                >
                  <option value="">
                    {crmText(
                      "Избери член на тим",
                      "Select team member",
                      "Zgjidh anëtar ekipi",
                    )}
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
                "Промена на одговорен центар",
                "Change responsible centre",
                "Ndrysho qendrën përgjegjëse",
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
                    "Побарано е примопредавање. Сега треба одобрување од изворниот и целниот центар.",
                    "Handover requested. Approval is now required from both the source and destination centre.",
                    "Dorëzimi u kërkua. Tani nevojitet miratim nga qendra burimore dhe destinacioni.",
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
                  "Причина за промена на одговорен центар",
                  "Reason for changing responsible centre",
                  "Arsyeja për ndryshimin e qendrës përgjegjëse",
                )}
              />
              <button className="primary">
                {crmText(
                  "Побарај промена",
                  "Request change",
                  "Kërko ndryshimin",
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
                    <span>
                      {crmText("Изворен центар", "Source centre", "Qendra burimore")}: {transfer.sourceApprovedBy ? crmText("Одобрено", "Approved", "Miratuar") : crmText("Чека одобрување", "Awaiting approval", "Në pritje të miratimit")}
                    </span>
                    <span>
                      {crmText("Целен центар", "Destination centre", "Qendra destinacion")}: {transfer.destinationApprovedBy ? crmText("Одобрено", "Approved", "Miratuar") : crmText("Чека одобрување", "Awaiting approval", "Në pritje të miratimit")}
                    </span>
                    {transfer.approvalStatus === "Pending" && (
                      <div className="contact-handover-approval-actions">
                        <button type="button" className="primary" onClick={() => void approveTransfer(transfer.id, "approve")}>
                          {crmText("Одобри моја страна", "Approve my side", "Mirato anën time")}
                        </button>
                        <button type="button" onClick={() => void approveTransfer(transfer.id, "reject")}>
                          {crmText("Одбиј", "Reject", "Refuzo")}
                        </button>
                      </div>
                    )}
                    <time>
                      {new Date(transfer.transferredAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="contact-action-group contact-action-wide contact-activity-panel">
            <span className="contact-action-label">
              {crmText(
                "Историја и внатрешни белешки",
                "History and internal notes",
                "Historia dhe shënimet e brendshme",
              )}
            </span>
            <form
              className="inline-form contact-reply-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const ok = await call(
                  `/api/admin/contact-requests/${contactDetail.id}/internal-comments`,
                  {
                    method: "POST",
                    body: JSON.stringify({ body: data.get("body") }),
                  },
                  crmText(
                    "Внатрешната белешка е зачувана.",
                    "Internal note saved.",
                    "Shënimi i brendshëm u ruajt.",
                  ),
                );
                if (ok) {
                  form.reset();
                  await loadActivity();
                }
              }}
            >
              <input
                name="body"
                required
                placeholder={crmText(
                  "Додај внатрешна белешка само за тимот",
                  "Add an internal team-only note",
                  "Shto shënim të brendshëm vetëm për ekipin",
                )}
              />
              <button className="approve">{t.save}</button>
            </form>
            <div className="contact-activity-grid">
              <ActivityList
                title={crmText("Timeline", "Timeline", "Timeline")}
                empty={crmText(
                  "Нема активности.",
                  "No activity yet.",
                  "Ende nuk ka aktivitet.",
                )}
                items={activity}
                language={language}
              />
              <ActivityList
                title={crmText(
                  "Assignment history",
                  "Assignment history",
                  "Historia e caktimeve",
                )}
                empty={crmText(
                  "Нема доделувања.",
                  "No assignments yet.",
                  "Ende nuk ka caktime.",
                )}
                items={activity.filter((item) =>
                  item.action.includes("Assigned"),
                )}
                language={language}
              />
            </div>
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
                void updateContactService(event, contactDetail, service).then(
                  loadActivity,
                )
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
              <label className="admin-service-note">
                <span>
                  {crmText(
                    "Внатрешна белешка",
                    "Internal note",
                    "Shënim i brendshëm",
                  )}
                </span>
                <textarea
                  name="internalNote"
                  rows={3}
                  defaultValue={service.internalNote ?? ""}
                  placeholder={crmText(
                    "Следен чекор, ризик или договор со клиентот",
                    "Next step, risk or client agreement",
                    "Hapi tjetër, rreziku ose marrëveshja me klientin",
                  )}
                />
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

function ActivityList({
  title,
  empty,
  items,
  language,
}: {
  title: string;
  empty: string;
  items: ContactActivity[];
  language: Language;
}) {
  return (
    <section className="contact-activity-list">
      <h4>{title}</h4>
      {!items.length && <p>{empty}</p>}
      {items.slice(0, 8).map((item) => (
        <article key={`${title}-${item.id}`}>
          <b>{activityLabel(item, language)}</b>
          <span>{activityDetail(item)}</span>
          <small>
            {item.actorName ? `${item.actorName} · ` : ""}
            {new Date(item.createdAt).toLocaleString()}
          </small>
        </article>
      ))}
    </section>
  );
}

function activityLabel(item: ContactActivity, language: Language) {
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const labels: Record<string, string> = {
    ContactRequestCreated: text("Креирано барање", "Request created", "Kërkesa u krijua"),
    ContactRequestUpdated: text("Променет статус", "Status updated", "Statusi u përditësua"),
    ContactRequestAssigned: text("Доделен тим", "Team assigned", "Ekipi u caktua"),
    ContactRequestHandled: text("Барањето е услужено", "Request served", "Kërkesa u shërbye"),
    ContactRequestTransferred: text("Предадено на друг центар", "Handed over to another centre", "Dorëzuar te qendër tjetër"),
    ContactRequestResponded: text("Испратен одговор", "Response sent", "Përgjigjja u dërgua"),
    ContactRequestServiceAdded: text("Додадена услуга", "Service added", "Shërbimi u shtua"),
    ContactRequestServiceAddedByClient: text("Клиент додаде услуга", "Client added service", "Klienti shtoi shërbim"),
    ContactRequestServiceRemoved: text("Отстранета услуга", "Service removed", "Shërbimi u hoq"),
    ContactRequestServiceUpdated: text("Ажурирана услуга", "Service updated", "Shërbimi u përditësua"),
    ContactRequestServiceAssigned: text("Доделена услуга", "Service assigned", "Shërbimi u caktua"),
    ContactRequestInternalComment: text("Внатрешна белешка", "Internal note", "Shënim i brendshëm"),
  };
  return labels[item.action] ?? item.action;
}

function activityDetail(item: ContactActivity) {
  const metadata = parseJson(item.metadataJson);
  const next = parseJson(item.newValuesJson);
  if (typeof metadata?.body === "string") return metadata.body;
  if (typeof metadata?.name === "string") return metadata.name;
  if (typeof next?.name === "string") {
    const parts = [next.name, next.status].filter(Boolean);
    return parts.join(" · ");
  }
  return item.entityType;
}

function parseJson(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
