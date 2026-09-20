import type { FormEvent } from "react";
import type { Language } from "../../../shared/types";
import { labelFor } from "../../../shared/labels";
import { localeFor } from "../../../content/dashboardCopy";
import type { User } from "../../../pages/admin/adminModels";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { RegisteredAffiliatePartner } from "../../../pages/admin/adminModels";

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
  onSetAssignedBrand: (id: string, assignedBrand: string | null) => Promise<boolean>;
  onSetAssignedPartner: (id: string, partnerCode: string | null) => Promise<boolean>;
  partners: RegisteredAffiliatePartner[];
};

const knownBrands = ["digitmak", "vezilka", "hpc", "bau"] as const;

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
  onSetAssignedBrand,
  onSetAssignedPartner,
  partners,
}: Props) {
  // When the admin creating a new user is themselves scoped to one brand (not a
  // global/Platform admin), default the new user's brand to that same one — most new
  // users an admin adds belong to their own brand, so this saves picking it every time
  // while still letting them change it for the rare cross-brand case.
  const currentAdminBrand = users.find((item) => item.id === currentUserId)?.assignedBrand ?? "";
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
        <select name="assignedBrand" defaultValue={currentAdminBrand}>
          <option value="">Global / all brands (Admin only)</option>
          {knownBrands.map((brand) => <option key={brand} value={brand}>{brand.toUpperCase()}</option>)}
        </select>
        <select name="assignedPartnerCode" defaultValue="">
          <option value="">All partners in selected brand</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.partnerCode}>
              {partner.brandCode.toUpperCase()} · {partner.name}
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
              {item.roles.includes("PlatformAdmin") ? (
                <div className="action-row">
                  <b>{language === "mk" ? "Platform Admin · Гледа сè" : "Platform Admin · Sees everything"}</b>
                </div>
              ) : item.roles.some((roleName) =>
                ["Admin", "HelpDeskAgent", "Expert"].includes(roleName),
              ) && (
                <div className="action-row">
                  <label className="admin-brand-scope-label">
                    <span>
                      {item.assignedPartnerCode
                        ? (language === "mk" ? "Partner Admin:" : language === "sq" ? "Partner Admin:" : "Partner Admin:")
                        : item.assignedBrand
                          ? (language === "mk" ? "Brand Admin:" : language === "sq" ? "Brand Admin:" : "Brand Admin:")
                          : (language === "mk" ? "Global Admin:" : language === "sq" ? "Global Admin:" : "Global Admin:")}
                    </span>
                    {language === "mk"
                      ? " Гледа:"
                      : language === "sq"
                        ? " Sheh:"
                        : " Sees:"}
                    <select
                      value={item.assignedBrand ?? ""}
                      onChange={(event) =>
                        void onSetAssignedBrand(item.id, event.target.value || null)
                      }
                    >
                      <option value="">
                        {language === "mk" ? "Сите брендови" : language === "sq" ? "Të gjitha brendet" : "All brands"}
                      </option>
                      {knownBrands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    {item.assignedBrand && (
                      <select
                        value={item.assignedPartnerCode ?? ""}
                        onChange={(event) =>
                          void onSetAssignedPartner(item.id, event.target.value || null)
                        }
                      >
                        <option value="">Сите партнери</option>
                        {partners
                          .filter((partner) => partner.brandCode === item.assignedBrand)
                          .map((partner) => (
                            <option key={partner.id} value={partner.partnerCode}>
                              {partner.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </label>
                </div>
              )}
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
