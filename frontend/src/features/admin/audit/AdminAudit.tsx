import type { Language } from "../../../shared/types";
import { localeFor } from "../../../content/dashboardCopy";
import type { Audit } from "../../../pages/admin/adminModels";
import type { workspaceCopy } from "../../../content/workspaceCopy";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  audits: Audit[];
};

export function AdminAudit({ t, language, audits }: Props) {
  return (
    <div className="ticket-list">
      <div className="list-head">
        <h2>{t.systemActivities}</h2>
      </div>
      {audits.map((item) => (
        <div className="ticket" key={item.id}>
          <span className="tag blue">{item.entityType}</span>
          <div>
            <b>{item.action}</b>
            <small>{item.entityId}</small>
          </div>
          <span>
            {new Date(item.createdAt).toLocaleString(localeFor(language))}
          </span>
        </div>
      ))}
    </div>
  );
}
