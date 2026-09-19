import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Language } from "../../../shared/types";
import type { AffiliateOverview } from "../../../pages/admin/adminModels";
import { api } from "../../../api";

const partnerLabels = {
  mk: { title: "Партнерски линкови", kicker: "ПАРТНЕРСКИ ЛИНКОВИ", clicks: "Кликови", leads: "Барања", served: "Услужени", rate: "Конверзија" },
  en: { title: "Partner links", kicker: "PARTNER LINKS", clicks: "Clicks", leads: "Leads", served: "Served", rate: "Conversion" },
  sq: { title: "Lidhje partnerësh", kicker: "LIDHJE PARTNERËSH", clicks: "Klikime", leads: "Kërkesa", served: "Të shërbyera", rate: "Konvertimi" },
} as const;

const knownBrands = ["digitmak", "vezilka", "hpc", "bau"] as const;

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function AdminAffiliate({ language, version }: { language: Language; version: number }) {
  const [data, setData] = useState<AffiliateOverview>();
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedKey, setCopiedKey] = useState("");
  const tx = partnerLabels[language];

  useEffect(() => {
    let active = true;
    api<AffiliateOverview>(`/api/admin/affiliate/overview?v=${version}-${refreshKey}`)
      .then((result) => active && setData(result))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Affiliate data unavailable."));
    return () => { active = false; };
  }, [version, refreshKey]);

  useEffect(() => {
    let active = true;
    api<{ id: string; name: string }[]>("/api/admin/organizations")
      .then((result) => active && setOrganizations(result))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const copyLink = (key: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 1800);
  };

  const addPartner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormError("");
    setSubmitting(true);
    try {
      await api("/api/admin/affiliate/partners", {
        method: "POST",
        body: JSON.stringify({
          brandCode: data.get("brandCode"),
          partnerCode: data.get("partnerCode"),
          name: data.get("name") || undefined,
          linkedOrganizationId: data.get("linkedOrganizationId") || undefined,
        }),
      });
      event.currentTarget.reset();
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not register partner.");
    } finally {
      setSubmitting(false);
    }
  };

  const setPartnerOrganization = async (id: string, linkedOrganizationId: string | null) => {
    try {
      await api(`/api/admin/affiliate/partners/${id}/organization`, {
        method: "PUT",
        body: JSON.stringify({ linkedOrganizationId }),
      });
      setRefreshKey((key) => key + 1);
    } catch {
      // Silently ignored — the table simply keeps its previous state if this fails.
    }
  };

  const removePartner = async (id: string) => {
    try {
      await api(`/api/admin/affiliate/partners/${id}`, { method: "DELETE" });
      setRefreshKey((key) => key + 1);
    } catch {
      // Silently ignored — the table simply keeps its previous state if the delete fails.
    }
  };

  if (error) return <p className="form-error">{error}</p>;
  const totals = data?.totals;
  return (
    <div className="affiliate-admin">
      <div className="affiliate-kpis">
        <div><small>{tx.clicks}</small><strong>{totals?.clicks ?? 0}</strong></div>
        <div><small>Пополнети форми</small><strong>{totals?.formSubmissions ?? 0}</strong></div>
        <div><small>{tx.leads}</small><strong>{totals?.leads ?? 0}</strong></div>
        <div><small>{tx.served}</small><strong>{totals?.served ?? 0}</strong></div>
        <div><small>{tx.rate}</small><strong>{totals?.conversionRate ?? 0}%</strong></div>
      </div>

      <div className="affiliate-link-cards">
        {(data?.partners ?? []).map((partner) => {
          const url = `${window.location.origin}${partner.path}`;
          const copied = copiedKey === partner.code;
          return (
            <div className="affiliate-link-card" key={partner.code}>
              <div className="affiliate-link-card-head">
                <span className="affiliate-link-dot" />
                <div>
                  <strong>{partner.name}</strong>
                  <small>
                    {partner.clicks} {tx.clicks.toLowerCase()} · {partner.leads} {tx.leads.toLowerCase()}
                  </small>
                </div>
              </div>
              <div className="affiliate-link-url-row">
                <code className="affiliate-link-url">{url}</code>
                <button
                  type="button"
                  className={`affiliate-copy-btn${copied ? " copied" : ""}`}
                  onClick={() => copyLink(partner.code, url)}
                  aria-label={`Copy ${partner.name} link`}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Копирано" : "Копирај"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="affiliate-table-wrap">
        <table className="affiliate-table">
          <thead><tr><th>Brand</th><th>Link</th><th>{tx.clicks}</th><th>{tx.leads}</th><th>{tx.served}</th><th>{tx.rate}</th></tr></thead>
          <tbody>
            {(data?.partners ?? []).map((partner) => (
              <tr key={partner.code}>
                <td><strong>{partner.name}</strong><small>{partner.code}</small></td>
                <td><code>{partner.path}</code></td>
                <td>{partner.clicks}</td>
                <td>{partner.leads}</td>
                <td>{partner.served}</td>
                <td><strong>{partner.conversionRate}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list-head">
        <h3>Партнери по бренд</h3>
      </div>
      <form className="form-card affiliate-add-partner" onSubmit={addPartner}>
        <label>
          Бренд
          <select name="brandCode" required defaultValue="">
            <option value="" disabled>
              Избери бренд
            </option>
            {knownBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Код на партнер
          <input
            name="partnerCode"
            required
            placeholder="пр. partner-01"
            pattern="[a-z0-9-]{1,64}"
            title="Само мали букви, бројки и цртичка"
          />
        </label>
        <label>
          Име (опционо)
          <input name="name" placeholder="пр. Партнер 01" />
        </label>
        <label>
          CRM организација (опционо)
          <select name="linkedOrganizationId" defaultValue="">
            <option value="">Без поврзување</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Се додава…" : "Додај партнер"}
        </button>
        {formError && <p className="form-error">{formError}</p>}
      </form>
      <div className="affiliate-table-wrap">
        <table className="affiliate-table">
          <thead>
            <tr>
              <th>Бренд</th>
              <th>Партнер</th>
              <th>Линк</th>
              <th>Организација</th>
              <th>{tx.clicks}</th>
              <th>{tx.leads}</th>
              <th>{tx.served}</th>
              <th>{tx.rate}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.partnerBreakdown ?? []).map((row) => {
              const url = `${window.location.origin}${row.path}`;
              const rowKey = `${row.brandCode}-${row.partnerCode}`;
              const copied = copiedKey === rowKey;
              return (
                <tr key={rowKey}>
                  <td>{row.brandName}</td>
                  <td>{row.partnerName ?? row.partnerCode}<small> {row.partnerCode}</small></td>
                  <td><code>{row.path}</code></td>
                  <td>
                    {row.id ? (
                      <select
                        value={row.linkedOrganizationId ?? ""}
                        onChange={(event) => void setPartnerOrganization(row.id!, event.target.value || null)}
                      >
                        <option value="">—</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{row.clicks}</td>
                  <td>{row.leads}</td>
                  <td>{row.served}</td>
                  <td><strong>{row.conversionRate}%</strong></td>
                  <td className="affiliate-row-actions">
                    <button
                      type="button"
                      className={`affiliate-copy-btn small${copied ? " copied" : ""}`}
                      onClick={() => copyLink(rowKey, url)}
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    {row.id && (
                      <button type="button" className="secondary" onClick={() => void removePartner(row.id!)}>
                        Отстрани
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(data?.partnerBreakdown?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={9}>Сеуште нема регистрирани партнери или сообраќај.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
