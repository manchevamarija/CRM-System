import type { Language } from "../../../shared/types";
import { labelFor } from "../../../shared/labels";
import type {
  Organization,
  OrgDetail,
  User,
} from "../../../pages/admin/adminModels";
import { useState, type FormEvent } from "react";
import type { workspaceCopy } from "../../../content/workspaceCopy";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  organizations: Organization[];
  detail: OrgDetail | null;
  onMembers: (id: string) => Promise<void>;
  onAction: (id: string, action: string) => Promise<boolean>;
  onMemberAction: (path: string) => Promise<boolean>;
  users: User[];
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
  onSetParent: (id: string, parentOrganizationId: string | null) => Promise<boolean>;
  onTransferClient: (userId: string, toOrganizationId: string) => Promise<boolean>;
};

export function AdminOrganizations({
  t,
  language,
  organizations,
  detail,
  onMembers,
  onAction,
  onMemberAction,
  users,
  onCreate,
  onSetParent,
  onTransferClient,
}: Props) {
  const [customType, setCustomType] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  return (
    <>
      <form
        className="workspace admin-org-create"
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const type = customType
            ? String(data.get("customType") ?? "").trim()
            : data.get("type");
          const ok = await onCreate({
            name: data.get("name"),
            type,
            sector: data.get("sector") || null,
            region: data.get("region") || null,
            clientUserId: data.get("clientUserId") || null,
            parentOrganizationId: data.get("parentOrganizationId") || null,
            brand: data.get("brand") || null,
          });
          if (ok) {
            form.reset();
            setCustomType(false);
          }
        }}
      >
        <div className="list-head">
          <div>
            <span className="kicker">CRM SYSTEM</span>
            <h2>
              {language === "mk"
                ? "Креирај организација и додели клиент"
                : "Create organisation and assign client"}
            </h2>
            <p>
              {language === "mk"
                ? "Само администратор може да креира организација и да поврзе клиентски профил."
                : "Only an administrator can create an organisation and link a client profile."}
            </p>
          </div>
        </div>
        <div className="admin-org-create-grid">
          <input
            name="name"
            required
            placeholder={
              language === "mk" ? "Назив на организација" : "Organisation name"
            }
          />
          <select name="brand" defaultValue="">
            <option value="">Brand (current)</option>
            <option value="digitmak">DIGITMAK</option>
            <option value="bau">BAU</option>
            <option value="vezilka">VEZILKA</option>
            <option value="hpc">HPC</option>
          </select>
          <select
            name="type"
            onChange={(event) => setCustomType(event.target.value === "Custom")}
          >
            <option value="SME">SME</option>
            <option value="Company">Company</option>
            <option value="PublicInstitution">Public institution</option>
            <option value="NGO">NGO</option>
            <option value="Custom">
              {language === "mk" ? "Друго — внеси тип" : "Other — enter type"}
            </option>
          </select>
          {customType && (
            <input
              name="customType"
              required
              placeholder={
                language === "mk"
                  ? "Нов тип на организација"
                  : "New organisation type"
              }
            />
          )}
          <input
            name="sector"
            placeholder={language === "mk" ? "Сектор" : "Sector"}
          />
          <input
            name="region"
            placeholder={language === "mk" ? "Регион" : "Region"}
          />
          <select name="clientUserId">
            <option value="">
              {language === "mk" ? "Без клиент (само организација)" : "No client (organisation only)"}
            </option>
            {users
              .filter(
                (user) => user.roles.includes("Client") && !user.organizationId,
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} · {user.email}
                </option>
              ))}
          </select>
          <select name="parentOrganizationId">
            <option value="">
              {language === "mk"
                ? "Без родителска организација"
                : "No parent organisation"}
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button className="primary">
            {language === "mk" ? "Креирај и додели" : "Create and assign"}
          </button>
        </div>
      </form>
      <div className="ticket-list">
        <div className="list-head">
          <h2>{t.organizations}</h2>
        </div>
        {organizations.map((item) => (
          <div className="approval" key={item.id}>
            <div>
              <b>{item.name}</b>
              <small>
                {item.brand.toUpperCase()} · {labelFor(item.type, language)} · {item.region ?? "—"} ·{" "}
                {labelFor(item.status, language)}
                {item.parentOrganizationId &&
                  ` · ${language === "mk" ? "Под:" : "Under:"} ${
                    organizations.find((org) => org.id === item.parentOrganizationId)
                      ?.name ?? "—"
                  }`}
              </small>
            </div>
            <select
              value={item.parentOrganizationId ?? ""}
              onChange={(event) =>
                void onSetParent(item.id, event.target.value || null)
              }
            >
              <option value="">
                {language === "mk" ? "Без родител" : "No parent"}
              </option>
              {organizations
                .filter((org) => org.id !== item.id)
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
            </select>
            <select
              value={transferTarget[`org-${item.id}`] ?? ""}
              onChange={(event) =>
                setTransferTarget((prev) => ({
                  ...prev,
                  [`org-${item.id}`]: event.target.value,
                }))
              }
            >
              <option value="">
                {language === "mk" ? "Додели клиент…" : "Assign client…"}
              </option>
              {users
                .filter((user) => user.roles.includes("Client") && !user.organizationId)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} · {user.email}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="secondary"
              disabled={!transferTarget[`org-${item.id}`]}
              onClick={async () => {
                const userId = transferTarget[`org-${item.id}`];
                if (!userId) return;
                const ok = await onTransferClient(userId, item.id);
                if (ok) {
                  setTransferTarget((prev) => {
                    const next = { ...prev };
                    delete next[`org-${item.id}`];
                    return next;
                  });
                }
              }}
            >
              {language === "mk" ? "Додели" : "Assign"}
            </button>
            <button onClick={() => onMembers(item.id)}>{t.members}</button>
            {item.status === "PendingApproval" && (
              <>
                <button
                  className="approve"
                  onClick={() => onAction(item.id, "approve")}
                >
                  {t.approve}
                </button>
                <button
                  className="reject"
                  onClick={() => onAction(item.id, "reject")}
                >
                  {t.reject}
                </button>
              </>
            )}
            {item.status === "Approved" && (
              <button
                className="reject"
                onClick={() => onAction(item.id, "suspend")}
              >
                {t.suspend}
              </button>
            )}
            {item.status === "Suspended" && (
              <button
                className="approve"
                onClick={() => onAction(item.id, "reactivate")}
              >
                {t.reactivate}
              </button>
            )}
          </div>
        ))}
      </div>
      {detail && (
        <div className="workspace">
          <h2>
            {t.members}: {detail.organization.name}
          </h2>
          {detail.members.map((member) => (
            <div className="approval" key={member.id}>
              <div>
                <b>
                  {member.firstName} {member.lastName}
                </b>
                <small>
                  {member.email} · {member.memberStatus}
                </small>
              </div>
              {member.memberStatus === "Pending" && (
                <>
                  <button
                    className="approve"
                    onClick={() =>
                      onMemberAction(
                        `/api/admin/organization-members/${member.id}/approve`,
                      )
                    }
                  >
                    {t.approve}
                  </button>
                  <button
                    className="reject"
                    onClick={() =>
                      onMemberAction(
                        `/api/admin/organization-members/${member.id}/reject`,
                      )
                    }
                  >
                    {t.reject}
                  </button>
                </>
              )}
              <select
                value={transferTarget[member.userId] ?? ""}
                onChange={(event) =>
                  setTransferTarget((prev) => ({
                    ...prev,
                    [member.userId]: event.target.value,
                  }))
                }
              >
                <option value="">
                  {language === "mk"
                    ? "Префрли во..."
                    : "Transfer to..."}
                </option>
                {organizations
                  .filter((org) => org.id !== detail.organization.id)
                  .map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!transferTarget[member.userId]}
                onClick={async () => {
                  const target = transferTarget[member.userId];
                  if (!target) return;
                  const ok = await onTransferClient(member.userId, target);
                  if (ok) {
                    setTransferTarget((prev) => {
                      const next = { ...prev };
                      delete next[member.userId];
                      return next;
                    });
                    void onMembers(detail.organization.id);
                  }
                }}
              >
                {language === "mk" ? "Префрли" : "Transfer"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
