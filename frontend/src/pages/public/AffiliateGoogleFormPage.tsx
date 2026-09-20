import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { Navigate } from "../../shared/types";

type AffiliateCode = "digitmak" | "hpc" | "vezilka" | "bau";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfSUlJVyKm46FSXymdM_Hg_nEkFwg8B6ZvDLcsQb0zTjz4z9A/viewform?usp=pp_url";
// This is the first question in the current Google Form ("За кој центар/сајт...").
// Keep this configurable so the form owner can replace it if Google regenerates the prefill id.
const GOOGLE_FORM_BRAND_ENTRY_ID = import.meta.env.VITE_GOOGLE_FORM_BRAND_ENTRY_ID ?? "1452035505";

const BRAND_NAMES: Record<AffiliateCode, string> = {
  digitmak: "DIGITMAK",
  hpc: "HPC",
  vezilka: "VEZILKA",
  bau: "BAU",
};

function storageKey(brand: AffiliateCode, partner?: string) {
  return `crm-system.affiliate.${brand}.${partner ?? "root"}`;
}

export function AffiliateGoogleFormPage({
  onNavigate,
  affiliateCode,
  affiliatePartnerCode,
}: {
  onNavigate?: Navigate;
  affiliateCode: AffiliateCode;
  affiliatePartnerCode?: string;
}) {
  const [trackingReady, setTrackingReady] = useState(false);
  const storage = storageKey(affiliateCode, affiliatePartnerCode);

  const formUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (GOOGLE_FORM_BRAND_ENTRY_ID) {
      params.set(`entry.${GOOGLE_FORM_BRAND_ENTRY_ID}`, BRAND_NAMES[affiliateCode]);
    }
    return `${GOOGLE_FORM_URL}&${params.toString()}`;
  }, [affiliateCode]);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(storage);
      if (raw) {
        const stored = JSON.parse(raw) as { clickId?: string; timestamp?: number };
        if (stored.clickId && (!stored.timestamp || Date.now() - stored.timestamp < 30 * 24 * 60 * 60 * 1000)) {
          // Already recorded a click for this brand+partner recently — nothing more to do.
          setTrackingReady(true);
          return;
        }
        localStorage.removeItem(storage);
      }
    } catch {
      // Continue with a fresh click.
    }

    void api<{ clickId: string }>("/api/public/affiliate/click", {
      method: "POST",
      body: JSON.stringify({
        code: affiliateCode,
        partnerCode: affiliatePartnerCode ?? null,
        landingPath: window.location.pathname,
        referrer: document.referrer || null,
      }),
    })
      .then((result) => {
        if (cancelled) return;
        setTrackingReady(true);
        localStorage.setItem(
          storage,
          JSON.stringify({ clickId: result.clickId, timestamp: Date.now() }),
        );
      })
      .catch(() => {
        if (!cancelled) setTrackingReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [affiliateCode, affiliatePartnerCode, storage]);


  const partnerLabel = affiliatePartnerCode
    ? `${BRAND_NAMES[affiliateCode]} · ${affiliatePartnerCode}`
    : BRAND_NAMES[affiliateCode];

  return (
    <section className="affiliate-google-form-page">
      <div className="affiliate-google-form-head">
        <span className="kicker">AFFILIATE</span>
        <h1>{partnerLabel}</h1>
        <p>
          Ве молиме пополнете ја формата подолу. Сите affiliate линкови користат една иста форма.
        </p>
        {!trackingReady && <small>Подготовка на affiliate tracking…</small>}
      </div>
      <div className="affiliate-google-form-frame-wrap">
        <iframe
          title="CRM барање"
          src={formUrl}
          className="affiliate-google-form-frame"
          loading="eager"
          allow="clipboard-write"
        />
      </div>
      <button type="button" className="button button-secondary" onClick={() => onNavigate?.("home" as never)}>
        Назад
      </button>
    </section>
  );
}
