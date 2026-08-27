import { workspaceCopy } from "../../content/workspaceCopy";
import { labelFor } from "../../shared/labels";
import type { Language } from "../../shared/types";
import type { StaffOrganizationDetail } from "./staffModels";

type Props = {
  detail: StaffOrganizationDetail;
  language: Language;
  onClose: () => void;
};

export function StaffOrganizationCard({ detail, language, onClose }: Props) {
  const t = workspaceCopy(language);
  const organization = detail.organization;

  return (
    <div className="workspace organization-detail">
      <div className="organization-detail-head">
        <button className="back-link" onClick={onClose}>
          × {t.close}
        </button>
        <span className="kicker">{t.clientOrganization}</span>
      </div>
      <h2>{organization.name}</h2>
      <p>
        {labelFor(organization.type, language)} · {organization.sector ?? "—"} ·{" "}
        {organization.municipality ?? organization.region ?? "—"}
      </p>
      <p>
        {organization.employeeCount ?? "—"} {t.employees} ·{" "}
        {labelFor(organization.status, language)}
      </p>
      {organization.website && (
        <a href={organization.website} target="_blank" rel="noreferrer">
          {organization.website}
        </a>
      )}
      <h3>{t.activeContacts}</h3>
      {detail.members.map((member) => (
        <div className="approval" key={member.id}>
          <div>
            <b>
              {member.firstName} {member.lastName}
              {member.isPrimaryContact ? ` · ${t.primaryContact}` : ""}
            </b>
            <small>
              {member.email} · {member.phoneNumber ?? "—"}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
