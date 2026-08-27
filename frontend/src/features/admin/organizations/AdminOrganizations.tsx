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
}: Props) {
  const [customType, setCustomType] = useState(false);
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
            clientUserId: data.get("clientUserId"),
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
          <select name="clientUserId" required>
            <option value="">
              {language === "mk" ? "Избери клиент" : "Select client"}
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
                {labelFor(item.type, language)} · {item.region ?? "—"} ·{" "}
                {labelFor(item.status, language)}
              </small>
            </div>
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
            </div>
          ))}
        </div>
      )}
    </>
  );
}
