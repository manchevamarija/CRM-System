import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type {
  Organization,
  Subscription,
  SubscriptionInvitation,
} from "../../shared/domain";
import type { Navigate } from "../../shared/types";
import { useApiResource } from "../../shared/useApiResource";
import { labelFor } from "../../shared/labels";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import { dashboardCopy, localeFor } from "../../content/dashboardCopy";
import type { AccountChangeRequest, PaymentInstructions } from "./clientModels";
import { PaymentRow } from "./PaymentRow";

export { ClientCrmPanel } from "./ClientCrmPanel";

export function OrganizationPanel({
  organization,
  subscription,
  invitation,
  paymentInstructions,
  changeRequests,
  onNavigate,
  onChanged,
}: {
  organization: Organization | null;
  subscription: Subscription | null;
  invitation: SubscriptionInvitation | null;
  paymentInstructions: PaymentInstructions | null;
  changeRequests: AccountChangeRequest[];
  onNavigate: Navigate;
  onChanged: () => void;
}) {
  const language = usePortalLanguage();
  const t = dashboardCopy[language].client;
  const [subscriptionError, setSubscriptionError] = useState("");
  const [changeError, setChangeError] = useState("");
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequestSent, setChangeRequestSent] = useState(false);
  const availableOrganizations = useApiResource<
    Pick<Organization, "id" | "name" | "type" | "region">[]
  >("/api/organizations/available");
  if (!organization)
    return (
      <div className="empty-panel">
        <h2>{t.noOrganization}</h2>
        <p>{t.createOrJoin}</p>
        <button className="primary" onClick={() => onNavigate("organization")}>
          {t.organization}
        </button>
      </div>
    );
  const accept = async () => {
    if (!invitation) return;
    try {
      await api(`/api/subscriptions/${invitation.id}/accept`, {
        method: "POST",
      });
      onChanged();
    } catch (reason) {
      setSubscriptionError(
        reason instanceof Error ? reason.message : t.invitationError,
      );
    }
  };
  const requestChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const requestType = String(data.get("requestType"));
    const details = String(data.get("details") ?? "").trim();
    try {
      await api("/api/account-change-requests/", {
        method: "POST",
        body: JSON.stringify({
          requestType:
            requestType === "organization" ? "Organization" : "Subscription",
          details,
        }),
      });
      form.reset();
      setShowChangeRequest(false);
      setChangeRequestSent(true);
      setChangeError("");
      onChanged();
    } catch (reason) {
      setChangeError(
        reason instanceof Error
          ? reason.message
          : language === "mk"
            ? "Барањето не може да се испрати."
            : "The request could not be sent.",
      );
    }
  };
  const canAcceptInvitation =
    invitation != null &&
    (!subscription || ["Cancelled", "Expired"].includes(subscription.status));
  return (
    <div className="workspace two-column">
      <article className="detail-card">
        <span className="kicker">{t.organization.toUpperCase()}</span>
        <h2>{organization.name}</h2>
        <dl>
          <div>
            <dt>{t.type}</dt>
            <dd>{labelFor(organization.type, language)}</dd>
          </div>
          <div>
            <dt>{t.sector}</dt>
            <dd>{organization.sector || "—"}</dd>
          </div>
          <div>
            <dt>{t.region}</dt>
            <dd>{organization.region || "—"}</dd>
          </div>
          <div>
            <dt>{t.status}</dt>
            <dd>{labelFor(organization.status, language)}</dd>
          </div>
        </dl>
      </article>
      <article className="detail-card">
        <span className="kicker">{t.subscription.toUpperCase()}</span>
        <h2>
          {canAcceptInvitation
            ? t.invitation
            : subscription?.status
              ? labelFor(subscription.status, language)
              : t.noInvitation}
        </h2>
        {canAcceptInvitation && invitation && (
          <>
            <p>
              {t.invitationUntil}{" "}
              {new Date(invitation.expiresAt).toLocaleDateString(
                localeFor(language),
              )}
              .
            </p>
            <button className="primary" onClick={accept}>
              {t.acceptInvitation}
            </button>
          </>
        )}
        {subscription?.status === "PendingPayment" && (
          <>
            <p>{t.pendingPayment}</p>
            {paymentInstructions?.isConfigured ? (
              <section className="payment-instructions">
                <h3>{t.paymentInstructions}</h3>
                <dl>
                  <PaymentRow
                    label={t.paymentRecipient}
                    value={paymentInstructions.recipient}
                  />
                  <PaymentRow
                    label={t.paymentBank}
                    value={paymentInstructions.bank}
                  />
                  <PaymentRow
                    label={t.paymentAccount}
                    value={paymentInstructions.account}
                  />
                  <PaymentRow label="IBAN" value={paymentInstructions.iban} />
                  <PaymentRow label="SWIFT" value={paymentInstructions.swift} />
                  <PaymentRow
                    label={t.paymentAmount}
                    value={`${paymentInstructions.amount} ${paymentInstructions.currency}`.trim()}
                  />
                  <PaymentRow
                    label={t.paymentPurpose}
                    value={paymentInstructions.purpose}
                  />
                  <PaymentRow
                    label={t.paymentReference}
                    value={paymentInstructions.referenceInstruction}
                  />
                </dl>
                {paymentInstructions.supportEmail && (
                  <p>
                    {t.paymentHelp}: {paymentInstructions.supportEmail}
                  </p>
                )}
              </section>
            ) : (
              <p className="notice padded">{t.paymentNotConfigured}</p>
            )}
          </>
        )}
        {subscription?.status === "Active" && (
          <p>
            {t.activeUntil}{" "}
            {subscription.expiresAt
              ? new Date(subscription.expiresAt).toLocaleDateString(
                  localeFor(language),
                )
              : "—"}
            .
          </p>
        )}
        {!subscription && !invitation && <p>{t.invitationMissing}</p>}
        {subscriptionError && <p className="form-error">{subscriptionError}</p>}
      </article>
      <article className="detail-card change-request-card">
        <div>
          <span className="kicker">
            {language === "mk"
              ? "ПРОМЕНА НА ПОДАТОЦИ"
              : language === "sq"
                ? "NDRYSHIM I TË DHËNAVE"
                : "ACCOUNT CHANGES"}
          </span>
          <h2>
            {language === "mk"
              ? "Организација или претплата"
              : language === "sq"
                ? "Organizata ose abonimi"
                : "Organization or subscription"}
          </h2>
          <p>
            {language === "mk"
              ? "Испратете барање до администраторот ако сакате да ја смените организацијата или условите на претплатата. Тековниот пристап останува активен додека барањето се разгледува."
              : language === "sq"
                ? "Dërgoni një kërkesë te administratori për të ndryshuar organizatën ose abonimin. Qasja aktuale mbetet aktive gjatë shqyrtimit."
                : "Send a request to the administrator to change the organization or subscription. Current access remains active while it is reviewed."}
          </p>
        </div>
        {!showChangeRequest && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setShowChangeRequest(true);
              setChangeRequestSent(false);
            }}
          >
            {language === "mk"
              ? "Побарај промена"
              : language === "sq"
                ? "Kërko ndryshim"
                : "Request a change"}
          </button>
        )}
        {showChangeRequest && (
          <form className="change-request-form" onSubmit={requestChange}>
            <label>
              {language === "mk" ? "Што сакате да смените?" : "Change type"}
              <select name="requestType" required>
                <option value="organization">
                  {language === "mk" ? "Организација" : "Organization"}
                </option>
                <option value="subscription">
                  {language === "mk" ? "Претплата" : "Subscription"}
                </option>
              </select>
            </label>
            <label>
              {language === "mk" ? "Опис на промената" : "Change details"}
              <textarea name="details" rows={4} required minLength={10} />
            </label>
            <div className="action-row">
              <button className="primary">
                {language === "mk" ? "Испрати барање" : "Send request"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowChangeRequest(false)}
              >
                {language === "mk" ? "Откажи" : "Cancel"}
              </button>
            </div>
          </form>
        )}
        {changeRequestSent && (
          <p className="form-success">
            {language === "mk"
              ? "Барањето е испратено. Статусот се прикажува подолу на оваа страница."
              : "The request was sent. Its status is shown below on this page."}
          </p>
        )}
        {!!changeRequests.length && (
          <div className="account-change-list">
            <h3>
              {language === "mk"
                ? "Мои барања за промена"
                : language === "sq"
                  ? "Kërkesat e mia për ndryshim"
                  : "My change requests"}
            </h3>
            {changeRequests.map((item) => (
              <article className="account-change-item" key={item.id}>
                <div>
                  <b>
                    {labelFor(item.requestType, language)} ·{" "}
                    {item.status === "Pending"
                      ? language === "mk"
                        ? "Се разгледува"
                        : language === "sq"
                          ? "Në shqyrtim"
                          : "Under review"
                      : item.status === "Accepted"
                        ? language === "mk"
                          ? "Одобрено"
                          : language === "sq"
                            ? "Miratuar"
                            : "Approved"
                        : item.status === "Applied"
                          ? language === "mk"
                            ? "Применето"
                            : language === "sq"
                              ? "U zbatua"
                              : "Applied"
                          : language === "mk"
                            ? "Одбиено"
                            : language === "sq"
                              ? "Refuzuar"
                              : "Declined"}
                  </b>
                  <p>{item.details}</p>
                  {item.decisionNote && <small>{item.decisionNote}</small>}
                </div>
                {item.status === "Accepted" &&
                  item.requestType === "Organization" && (
                    <form
                      className="account-change-apply"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const organizationId = String(
                          new FormData(form).get("organizationId") ?? "",
                        );
                        try {
                          await api(
                            `/api/account-change-requests/${item.id}/apply-organization`,
                            {
                              method: "POST",
                              body: JSON.stringify({ organizationId }),
                            },
                          );
                          setChangeError("");
                          onChanged();
                        } catch (reason) {
                          setChangeError(
                            reason instanceof Error
                              ? reason.message
                              : "The organization could not be changed.",
                          );
                        }
                      }}
                    >
                      <select name="organizationId" required defaultValue="">
                        <option value="" disabled>
                          {language === "mk"
                            ? "Изберете нова организација"
                            : language === "sq"
                              ? "Zgjidhni organizatën e re"
                              : "Choose the new organization"}
                        </option>
                        {(availableOrganizations.data ?? [])
                          .filter(
                            (candidate) => candidate.id !== organization.id,
                          )
                          .map((candidate) => (
                            <option value={candidate.id} key={candidate.id}>
                              {candidate.name} · {candidate.region}
                            </option>
                          ))}
                      </select>
                      <button className="secondary">
                        {language === "mk"
                          ? "Промени организација"
                          : language === "sq"
                            ? "Ndrysho organizatën"
                            : "Change organization"}
                      </button>
                    </form>
                  )}
                {item.status === "Accepted" &&
                  item.requestType === "Subscription" && (
                    <p className="notice padded">
                      {language === "mk"
                        ? "Промената е одобрена. Администраторот сега може да ви испрати нова покана за претплата."
                        : language === "sq"
                          ? "Ndryshimi u miratua. Administratori tani mund t'ju dërgojë një ftesë të re abonimi."
                          : "The change was approved. The administrator can now send a new subscription invitation."}
                    </p>
                  )}
              </article>
            ))}
          </div>
        )}
        {changeError && <p className="form-error">{changeError}</p>}
      </article>
    </div>
  );
}

export { ProfilePanel } from "./ClientProfilePanel";
