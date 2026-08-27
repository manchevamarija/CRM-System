import { api } from "../../../api";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { AccountChangeRequest } from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  requests: AccountChangeRequest[];
  loading: boolean;
  refresh: () => void;
  setError: (message: string) => void;
  setScopedSuccess: (value: { tab: "changes"; message: string }) => void;
};

export function AdminAccountChanges({
  t,
  language,
  requests,
  loading,
  refresh,
  setError,
  setScopedSuccess,
}: Props) {
  const accountChanges = { data: requests, loading };
  return (
    <section className="account-change-admin">
      <h2>
        {language === "mk"
          ? "Барања за промена"
          : language === "sq"
            ? "Kërkesa për ndryshim"
            : "Change requests"}
      </h2>
      {(accountChanges.data ?? []).map((item) => (
        <article className="account-change-item" key={item.id}>
          <div>
            <span
              className={`tag ${item.status === "Accepted" ? "status-complete" : item.status === "Declined" ? "status-new" : "status-progress"}`}
            >
              {item.status === "Pending"
                ? language === "mk"
                  ? "Се разгледува"
                  : "Under review"
                : item.status === "Accepted"
                  ? language === "mk"
                    ? "Одобрено"
                    : "Approved"
                  : language === "mk"
                    ? "Одбиено"
                    : "Declined"}
            </span>
            <h3>
              {item.firstName} {item.lastName}
            </h3>
            <small>
              {item.email} · {labelFor(item.requestType, language)}
            </small>
            <p>{item.details}</p>
            {item.decisionNote && <p>{item.decisionNote}</p>}
          </div>
          {item.status === "Pending" && (
            <form
              className="account-change-decision"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const submitter = (event.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement | null;
                try {
                  await api(
                    `/api/admin/account-change-requests/${item.id}/decision`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        status: submitter?.value,
                        note: data.get("note"),
                      }),
                    },
                  );
                  setScopedSuccess({
                    tab: "changes",
                    message:
                      language === "mk"
                        ? "Одлуката е зачувана и клиентот е известен."
                        : "The decision was saved and the client was notified.",
                  });
                  refresh();
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : language === "mk"
                        ? "Одлуката не може да се зачува."
                        : "The decision could not be saved.",
                  );
                }
              }}
            >
              <input
                name="note"
                placeholder={
                  language === "mk"
                    ? "Објаснување за клиентот"
                    : "Note for the client"
                }
              />
              <div className="action-row">
                <button className="approve" name="decision" value="Accepted">
                  {t.approve}
                </button>
                <button className="reject" name="decision" value="Declined">
                  {t.reject}
                </button>
              </div>
            </form>
          )}
        </article>
      ))}
      {!accountChanges.loading && !(accountChanges.data ?? []).length && (
        <p className="empty-state">
          {language === "mk"
            ? "Нема барања за промена."
            : "There are no change requests."}
        </p>
      )}
    </section>
  );
}
