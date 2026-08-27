import type { Dispatch, FormEvent, SetStateAction } from "react";
import { localeFor } from "../../../content/dashboardCopy";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type {
  AccountChangeRequest,
  Organization,
  Setting,
  Subscription,
  SubscriptionInvitation,
  User,
} from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";
import { AdminAccountChanges } from "./AdminAccountChanges";

type Resource<T> = { data: T[] | null; loading: boolean };
type Call = (
  path: string,
  options?: RequestInit,
  successMessage?: string,
) => Promise<boolean>;
type Props = {
  tab: "subscriptions" | "changes";
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  accountChanges: Resource<AccountChangeRequest>;
  users: Resource<User>;
  organizations: Resource<Organization>;
  subscriptions: Resource<Subscription>;
  invitations: Resource<SubscriptionInvitation>;
  settings: Resource<Setting>;
  selectedSubscriptionUserId: string;
  setSelectedSubscriptionUserId: Dispatch<SetStateAction<string>>;
  selectedSubscriptionUser?: User;
  call: Call;
  invite: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  renewSubscription: (subscription: Subscription) => Promise<boolean>;
  activate: (event: FormEvent<HTMLFormElement>, id: string) => Promise<void>;
  settingValue: (key: string) => string;
  savePaymentInstructions: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  refresh: () => void;
  setError: (message: string) => void;
  setScopedSuccess: (value: { tab: "changes"; message: string }) => void;
};

export function AdminSubscriptions(props: Props) {
  const {
    tab,
    t,
    language,
    accountChanges,
    users,
    organizations,
    subscriptions,
    invitations,
    settings,
    selectedSubscriptionUserId,
    setSelectedSubscriptionUserId,
    selectedSubscriptionUser,
    call,
    invite,
    renewSubscription,
    activate,
    settingValue,
    savePaymentInstructions,
    refresh,
    setError,
    setScopedSuccess,
  } = props;
  return (
    <div
      className={`workspace two-column ${tab === "changes" ? "change-requests-workspace" : "subscriptions-workspace"}`}
    >
      <div>
        <AdminAccountChanges
          t={t}
          language={language}
          requests={accountChanges.data ?? []}
          loading={accountChanges.loading}
          refresh={refresh}
          setError={setError}
          setScopedSuccess={setScopedSuccess}
        />
        <form className="workspace-form" onSubmit={invite}>
          <h2>{t.newInvitation}</h2>
          <label>
            {t.user}
            <select
              name="userId"
              required
              value={selectedSubscriptionUserId}
              onChange={(event) =>
                setSelectedSubscriptionUserId(event.target.value)
              }
            >
              <option value="">{t.choose}</option>
              {(users.data ?? [])
                .filter(
                  (item) =>
                    item.organizationId &&
                    item.status === "Active" &&
                    item.roles.includes("Client") &&
                    !item.roles.includes("Admin") &&
                    (organizations.data ?? []).some(
                      (organization) =>
                        organization.id === item.organizationId &&
                        organization.status === "Approved",
                    ) &&
                    !(subscriptions.data ?? []).some(
                      (subscription) =>
                        subscription.userId === item.id &&
                        subscription.status === "Active",
                    ),
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.email}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t.organization}
            <select
              name="organizationId"
              required
              disabled={!selectedSubscriptionUser}
              value={selectedSubscriptionUser?.organizationId ?? ""}
            >
              <option value="">{t.choose}</option>
              {(organizations.data ?? [])
                .filter(
                  (item) =>
                    item.status === "Approved" &&
                    item.id === selectedSubscriptionUser?.organizationId,
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="primary">{t.sendInvitation}</button>
        </form>
      </div>
      <div>
        <h2>{t.subscriptions}</h2>
        {(subscriptions.data ?? []).some(
          (item) => item.status === "PendingPayment",
        ) && <p className="notice padded">{t.pendingPaymentInstruction}</p>}
        {(subscriptions.data ?? []).map((item) => (
          <article className="meeting-card" key={item.id}>
            <span className="tag blue">{labelFor(item.status, language)}</span>
            <p>
              {users.data?.find((x) => x.id === item.userId)?.email ??
                item.userId}
            </p>
            {item.status === "PendingPayment" && (
              <form
                className="workspace-form"
                onSubmit={(event) => activate(event, item.id)}
              >
                <h3>{t.confirmOfflinePayment}</h3>
                <input
                  name="paymentReference"
                  required
                  placeholder={t.reference}
                />
                <input name="paymentNote" placeholder={t.note} />
                <button className="approve">{t.activate}</button>
              </form>
            )}
            {item.status === "Active" && (
              <button
                className="reject"
                onClick={() =>
                  call(`/api/admin/subscriptions/${item.id}/cancel`)
                }
              >
                {t.cancel}
              </button>
            )}
            {["Cancelled", "Expired"].includes(item.status) && (
              <button
                className="approve"
                onClick={() => renewSubscription(item)}
              >
                {t.renewSubscription}
              </button>
            )}
            {item.expiresAt && (
              <small>
                {t.validUntil}{" "}
                {new Date(item.expiresAt).toLocaleDateString(
                  localeFor(language),
                )}
              </small>
            )}
          </article>
        ))}
        <div className="subscription-invitation-history">
          <h2>
            {language === "en"
              ? "Invitation history"
              : language === "sq"
                ? "Historiku i ftesave"
                : "Историја на покани"}
          </h2>
          {(invitations.data ?? []).length === 0 && (
            <p>
              {language === "en"
                ? "No subscription invitations."
                : language === "sq"
                  ? "Nuk ka ftesa për abonim."
                  : "Нема покани за претплата."}
            </p>
          )}
          {(invitations.data ?? []).map((item) => (
            <article className="meeting-card" key={item.id}>
              <span className="tag blue">
                {labelFor(item.status, language)}
              </span>
              <p>
                {users.data?.find((userItem) => userItem.id === item.userId)
                  ?.email ?? item.userId}
              </p>
              <small>
                {language === "en"
                  ? "Expires"
                  : language === "sq"
                    ? "Skadon"
                    : "Истекува"}
                :{" "}
                {new Date(item.expiresAt).toLocaleDateString(
                  localeFor(language),
                )}
              </small>
            </article>
          ))}
        </div>
      </div>
      {tab === "subscriptions" && !settings.loading && (
        <form
          className="workspace-form payment-settings-form"
          onSubmit={savePaymentInstructions}
        >
          <h2>{t.paymentSettings}</h2>
          <p>{t.paymentSettingsHelp}</p>
          <label>
            {t.paymentRecipient}
            <input
              name="PAYMENT_RECIPIENT"
              defaultValue={settingValue("PAYMENT_RECIPIENT")}
            />
          </label>
          <label>
            {t.paymentBank}
            <input
              name="PAYMENT_BANK"
              defaultValue={settingValue("PAYMENT_BANK")}
            />
          </label>
          <label>
            {t.paymentAccount}
            <input
              name="PAYMENT_ACCOUNT"
              defaultValue={settingValue("PAYMENT_ACCOUNT")}
            />
          </label>
          <div className="row">
            <label>
              IBAN
              <input
                name="PAYMENT_IBAN"
                defaultValue={settingValue("PAYMENT_IBAN")}
              />
            </label>
            <label>
              SWIFT
              <input
                name="PAYMENT_SWIFT"
                defaultValue={settingValue("PAYMENT_SWIFT")}
              />
            </label>
          </div>
          <div className="row">
            <label>
              {t.paymentAmount}
              <input
                name="PAYMENT_AMOUNT"
                inputMode="decimal"
                defaultValue={settingValue("PAYMENT_AMOUNT")}
              />
            </label>
            <label>
              {t.paymentCurrency}
              <input
                name="PAYMENT_CURRENCY"
                placeholder="MKD / EUR"
                defaultValue={settingValue("PAYMENT_CURRENCY")}
              />
            </label>
          </div>
          <label>
            {t.paymentPurpose}
            <input
              name="PAYMENT_PURPOSE"
              defaultValue={settingValue("PAYMENT_PURPOSE")}
            />
          </label>
          <label>
            {t.paymentReferenceGuide}
            <textarea
              name="PAYMENT_REFERENCE_INSTRUCTION"
              rows={3}
              defaultValue={settingValue("PAYMENT_REFERENCE_INSTRUCTION")}
            />
          </label>
          <div className="payment-save-row">
            <label>
              {t.paymentSupportEmail}
              <input
                name="PAYMENT_SUPPORT_EMAIL"
                type="email"
                defaultValue={settingValue("PAYMENT_SUPPORT_EMAIL")}
              />
            </label>
            <button className="primary">{t.savePaymentSettings}</button>
          </div>
        </form>
      )}
    </div>
  );
}
