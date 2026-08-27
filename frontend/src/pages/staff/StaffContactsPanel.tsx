import { useState } from "react";
import { api } from "../../api";
import { workspaceCopy } from "../../content/workspaceCopy";
import { labelFor } from "../../shared/labels";
import type { Language } from "../../shared/types";
import type { StaffContact, StaffOrganizationDetail } from "./staffModels";

type Props = {
  contacts: StaffContact[];
  loading: boolean;
  language: Language;
  onError: (message: string) => void;
  onChanged: () => void;
};

export function StaffContactsPanel({
  contacts,
  loading,
  language,
  onError,
  onChanged,
}: Props) {
  const t = workspaceCopy(language);
  const [detail, setDetail] = useState<StaffOrganizationDetail | null>(null);

  const openOrganization = async (id: string) => {
    try {
      setDetail(
        await api<StaffOrganizationDetail>(`/api/staff/organizations/${id}`),
      );
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : t.loadOrganizationError,
      );
    }
  };

  return (
    <>
      <div className="ticket-list">
        <div className="list-head">
          <h2>{t.publicDma}</h2>
        </div>
        {contacts.map((item) => (
          <div className="approval" key={item.id}>
            <div>
              <b>{item.organizationName}</b>
              <small>
                {item.contactName} · {item.email} ·{" "}
                {labelFor(item.dmaCategory, language)} ·{" "}
                {labelFor(item.status, language)}
              </small>
            </div>
            <select
              value={item.status}
              aria-label={t.status}
              onChange={async (event) => {
                try {
                  await api(`/api/staff/contact-requests/${item.id}/workflow`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: event.target.value }),
                  });
                  onChanged();
                } catch (reason) {
                  onError(
                    reason instanceof Error
                      ? reason.message
                      : "Status update failed",
                  );
                }
              }}
            >
              {[
                "Contacting",
                "Assigned",
                "ServicesConfirmed",
                "InService",
                "FollowUp",
                "Served",
              ].map((status) => (
                <option key={status} value={status}>
                  {labelFor(status, language)}
                </option>
              ))}
            </select>
            {item.linkedOrganizationId && (
              <button
                onClick={() =>
                  void openOrganization(item.linkedOrganizationId!)
                }
              >
                {t.organization}
              </button>
            )}
          </div>
        ))}
        {!loading && !contacts.length && (
          <div className="empty-state">
            <h3>{t.noContactRequests}</h3>
            <p>{t.noContactRequestsHelp}</p>
          </div>
        )}
      </div>

      {detail && (
        <div className="workspace organization-detail">
          <div className="organization-detail-head">
            <button className="back-link" onClick={() => setDetail(null)}>
              × {t.close}
            </button>
            <span className="kicker">{t.clientOrganization}</span>
          </div>
          <h2>{detail.organization.name}</h2>
          <p>
            {labelFor(detail.organization.type, language)} ·{" "}
            {detail.organization.sector ?? "—"} ·{" "}
            {detail.organization.municipality ??
              detail.organization.region ??
              "—"}
          </p>
          <p>
            {detail.organization.employeeCount ?? "—"} {t.employees} ·{" "}
            {labelFor(detail.organization.status, language)}
          </p>
          {detail.organization.website && (
            <a
              href={detail.organization.website}
              target="_blank"
              rel="noreferrer"
            >
              {detail.organization.website}
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
      )}
    </>
  );
}
