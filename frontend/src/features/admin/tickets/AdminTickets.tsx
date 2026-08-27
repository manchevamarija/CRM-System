import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import { labelFor, ticketStatusClass } from "../../../shared/labels";
import type { Language } from "../../../shared/types";
import type { Ticket } from "../../../shared/domain";
import { StaffTicketDetail } from "../../../pages/staff/StaffTicketDetail";
import type {
  Organization,
  StaffUser,
  User,
} from "../../../pages/admin/adminModels";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  tickets: Ticket[];
  users: User[];
  organizations: Organization[];
  staff: StaffUser[];
  initialTicketId?: string;
  onChanged: () => void;
  onError: (message: string) => void;
};

const categories = [
  "AI_READINESS",
  "AI_ACT_COMPLIANCE",
  "AI_USE_CASE",
  "DATA_GOVERNANCE",
  "AUTOMATION_AND_INTELLIGENCE",
  "TEST_BEFORE_INVEST",
  "DIGITALIZATION_ROADMAP",
  "TRAINING_AND_SKILLS",
  "FUNDING_AND_INVESTMENT",
  "REFERRAL",
  "OTHER",
];

export function AdminTickets(props: Props) {
  const {
    t,
    language,
    tickets,
    users,
    organizations,
    staff,
    initialTicketId,
    onChanged,
    onError,
  } = props;
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const text = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;

  useEffect(() => {
    if (!initialTicketId) return;
    setSelected(tickets.find((item) => item.id === initialTicketId) ?? null);
  }, [initialTicketId, tickets]);

  const clients = useMemo(
    () =>
      users.filter(
        (item) =>
          item.roles.includes("Client") &&
          !item.roles.includes("Admin") &&
          item.status === "Active",
      ),
    [users],
  );
  const selectedClient = clients.find((item) => item.id === clientId);
  const clientOrganizations = organizations.filter(
    (item) =>
      item.id === selectedClient?.organizationId && item.status === "Approved",
  );
  const visibleTickets = tickets.filter(
    (item) =>
      (!search ||
        `${item.ticketNumber} ${item.title}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())) &&
      (!status || item.status === status) &&
      (!category || item.category === category),
  );

  const createTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const organizationId = String(data.get("organizationId") ?? "");
    try {
      await api("/api/admin/tickets", {
        method: "POST",
        body: JSON.stringify({
          userId: data.get("userId"),
          organizationId: organizationId || null,
          category: data.get("category"),
          priority: data.get("priority"),
          title: data.get("title"),
          description: data.get("description"),
        }),
      });
      form.reset();
      setClientId("");
      setCreating(false);
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : t.actionError);
    }
  };

  if (selected) {
    return (
      <StaffTicketDetail
        ticket={selected}
        staff={staff}
        organizationName={
          organizations.find((item) => item.id === selected.organizationId)
            ?.name
        }
        onBack={() => setSelected(null)}
        onChanged={() => {
          onChanged();
          setSelected(null);
        }}
        language={language}
        canAssign
      />
    );
  }

  return (
    <div className="ticket-list">
      <div className="list-head">
        <div>
          <div className="ticket-list-heading">
            <h2>
              {text(
                "Клиентски тикети",
                "Client tickets",
                "Tiketat e klientëve",
              )}
            </h2>
            <span className="ticket-count">
              {tickets.length} {text("тикети", "tickets", "tiketa")}
            </span>
          </div>
          <p>
            {text(
              "Преглед, доделување и одговарање на сите клиентски барања.",
              "Review, assign and reply to all client requests.",
              "Shikoni, caktoni dhe përgjigjuni të gjitha kërkesave të klientëve.",
            )}
          </p>
        </div>
        <button
          className="ticket-create-toggle"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          +{" "}
          {text(
            "Тикет во име на клиент",
            "Ticket on behalf of client",
            "Tiket në emër të klientit",
          )}
        </button>
      </div>

      {creating && (
        <form
          className="workspace-form admin-ticket-create"
          onSubmit={createTicket}
        >
          <h3>
            {text(
              "Креирај тикет во име на клиент",
              "Create a ticket on behalf of a client",
              "Krijo tiket në emër të klientit",
            )}
          </h3>
          <div className="row">
            <label>
              {text("Клиент", "Client", "Klienti")}
              <select
                name="userId"
                required
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">{t.choose}</option>
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName} · {item.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.organization}
              <select
                name="organizationId"
                disabled={!clientId || clientOrganizations.length === 0}
                defaultValue=""
              >
                <option value="">
                  {clientOrganizations.length === 0 && clientId
                    ? text(
                        "Без организација — може да се поврзе подоцна",
                        "No organization — can be linked later",
                        "Pa organizatë — mund të lidhet më vonë",
                      )
                    : t.choose}
                </option>
                {clientOrganizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              {text("Категорија", "Category", "Kategoria")}
              <select name="category" required>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value, language)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text("Приоритет", "Priority", "Prioriteti")}
              <select name="priority" defaultValue="Normal">
                {["Low", "Normal", "High", "Urgent"].map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value, language)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {text("Наслов", "Title", "Titulli")}
            <input name="title" required />
          </label>
          <label>
            {text("Опис", "Description", "Përshkrimi")}
            <textarea name="description" rows={5} required />
          </label>
          <button className="primary">
            {text(
              "Креирај за клиентот",
              "Create for client",
              "Krijo për klientin",
            )}
          </button>
        </form>
      )}

      <div className="ticket-filters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={text(
            "Пребарај по број или наслов",
            "Search by number or title",
            "Kërko sipas numrit ose titullit",
          )}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">
            {text("Сите статуси", "All statuses", "Të gjitha statuset")}
          </option>
          {["New", "Assigned", "InProgress", "Resolved", "Closed"].map(
            (value) => (
              <option key={value} value={value}>
                {labelFor(value, language)}
              </option>
            ),
          )}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">
            {text("Сите категории", "All categories", "Të gjitha kategoritë")}
          </option>
          {Array.from(new Set(tickets.map((item) => item.category))).map(
            (value) => (
              <option key={value} value={value}>
                {labelFor(value, language)}
              </option>
            ),
          )}
        </select>
      </div>
      {visibleTickets.map((item) => (
        <button
          className="ticket ticket-button"
          key={item.id}
          onClick={() => setSelected(item)}
        >
          <span className={`tag ${ticketStatusClass(item.status)}`}>
            {labelFor(item.status, language)}
          </span>
          <div>
            <b>
              {item.ticketNumber} — {item.title}
            </b>
            <small>
              {labelFor(item.category, language)} ·{" "}
              {labelFor(item.priority, language)}
            </small>
          </div>
          <span>
            {new Date(item.createdAt).toLocaleDateString(
              language === "mk" ? "mk-MK" : language,
            )}
          </span>
        </button>
      ))}
      {!visibleTickets.length && (
        <div className="empty-state">
          {text(
            "Нема тикети што одговараат на филтрите.",
            "No tickets match the filters.",
            "Nuk ka tiketa që përputhen me filtrat.",
          )}
        </div>
      )}
    </div>
  );
}
