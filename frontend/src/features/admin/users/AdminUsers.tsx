import type { FormEvent } from "react";
import type { Language } from "../../../shared/types";
import { labelFor } from "../../../shared/labels";
import { localeFor } from "../../../content/dashboardCopy";
import type { User } from "../../../pages/admin/adminModels";
import type { workspaceCopy } from "../../../content/workspaceCopy";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  currentUserId?: string;
  users: User[];
  roles: string[];
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateRole: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAssignRole: (
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) => Promise<void>;
  onRemoveRole: (id: string, role: string) => Promise<boolean>;
  onStatusChange: (user: User) => Promise<boolean>;
};

export function AdminUsers({
  t,
  language,
  currentUserId,
  users,
  roles,
  onCreateUser,
  onCreateRole,
  onAssignRole,
  onRemoveRole,
  onStatusChange,
}: Props) {
  return (
    <div className="ticket-list">
      <div className="list-head">
        <h2>{t.usersRoles}</h2>
      </div>
      <form className="admin-user-create-card" onSubmit={onCreateUser}>
        <div className="admin-user-create-heading">
          <b>
            {language === "en"
              ? "Add a new user"
              : language === "sq"
                ? "Shto përdorues të ri"
                : "Додај нов корисник"}
          </b>
          <small>
            {language === "en"
              ? "The user will receive a secure activation link and chooses their own password."
              : language === "sq"
                ? "Përdoruesi do të marrë lidhje të sigurt aktivizimi dhe zgjedh fjalëkalimin e vet."
                : "Корисникот ќе добие безбедна врска за активација и сам ќе избере лозинка."}
          </small>
        </div>
        <input
          name="firstName"
          required
          placeholder={
            language === "en"
              ? "First name"
              : language === "sq"
                ? "Emri"
                : "Име"
          }
        />
        <input
          name="lastName"
          required
          placeholder={
            language === "en"
              ? "Last name"
              : language === "sq"
                ? "Mbiemri"
                : "Презиме"
          }
        />
        <input
          name="email"
          type="email"
          required
          placeholder={language === "en" ? "Email" : "Е-пошта"}
        />
        <input
          name="phone"
          type="tel"
          placeholder={
            language === "en"
              ? "Phone (optional)"
              : language === "sq"
                ? "Telefoni (opsional)"
                : "Телефон (опционално)"
          }
        />
        <select name="role" required>
          {roles.map((roleName) => (
            <option key={roleName} value={roleName}>
              {labelFor(roleName, language)}
            </option>
          ))}
        </select>
        <button className="primary">
          +{" "}
          {language === "en"
            ? "Add user"
            : language === "sq"
              ? "Shto përdorues"
              : "Додај корисник"}
        </button>
      </form>
      <form className="create-role-card" onSubmit={onCreateRole}>
        <div>
          <b>
            {language === "en"
              ? "Create a new role"
              : language === "sq"
                ? "Krijo rol të ri"
                : "Креирај нова улога"}
          </b>
          <small>
            {language === "en"
              ? "Example: Invited user, Project manager or Adviser"
              : language === "sq"
                ? "Shembull: Përdorues i ftuar, Menaxher projekti ose Këshilltar"
                : "Пример: Поканет корисник, Проектен менаџер или Советник"}
          </small>
        </div>
        <input
          name="name"
          required
          minLength={2}
          maxLength={40}
          placeholder={
            language === "en"
              ? "New role name"
              : language === "sq"
                ? "Emri i rolit të ri"
                : "Име на новата улога"
          }
        />
        <button className="primary">
          +{" "}
          {language === "en"
            ? "Add role"
            : language === "sq"
              ? "Shto rol"
              : "Додај улога"}
        </button>
      </form>
      {users.map((item) => {
        const assignableRoles = roles.filter(
          (roleName) => !item.roles.includes(roleName),
        );
        return (
          <div className="approval" key={item.id}>
            <div>
              <b>
                {item.firstName} {item.lastName}
              </b>
              <small>
                {item.email} · {labelFor(item.status, language)} · {t.created}:{" "}
                {new Date(item.createdAt).toLocaleDateString(
                  localeFor(language),
                )}
                {item.emailVerifiedAt
                  ? ` · ${t.emailVerified}: ${new Date(item.emailVerifiedAt).toLocaleDateString(localeFor(language))}`
                  : ""}
              </small>
              <div className="action-row">
                {item.roles.map((roleName) => (
                  <button
                    key={roleName}
                    type="button"
                    className="secondary"
                    disabled={item.id === currentUserId && roleName === "Admin"}
                    onClick={() => void onRemoveRole(item.id, roleName)}
                  >
                    {labelFor(roleName, language)} ×
                  </button>
                ))}
              </div>
            </div>
            <form
              className="inline-form"
              onSubmit={(event) => onAssignRole(event, item.id)}
            >
              <select name="role" disabled={assignableRoles.length === 0}>
                {assignableRoles.length === 0 ? (
                  <option value="">
                    {language === "en"
                      ? "No available role"
                      : language === "sq"
                        ? "Nuk ka rol të lirë"
                        : "Нема достапна улога"}
                  </option>
                ) : (
                  assignableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {labelFor(roleName, language)}
                    </option>
                  ))
                )}
              </select>
              <button className="approve" disabled={assignableRoles.length === 0}>
                {t.addRole}
              </button>
            </form>
            <button className="reject" onClick={() => void onStatusChange(item)}>
              {item.status === "Active" ? t.deactivate : t.activate}
            </button>
          </div>
        );
      })}
    </div>
  );
}
