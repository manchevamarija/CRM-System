import { useTranslation } from "react-i18next";
import type { Navigate } from "../../shared/types";
import { activeBrand } from "../../config/brand";
export function Footer({ onNavigate }: { onNavigate: Navigate }) {
  const { t } = useTranslation();
  return (
    <footer>
      <div className="brand invert">
        <img
          className="crm-system-logo"
          src={activeBrand.footerLogo}
          alt={activeBrand.name}
        />
      </div>
      <p>{t("tagline")}</p>
      <div>
        <button onClick={() => onNavigate("services")}>{t("services")}</button>
        <button onClick={() => onNavigate("contact")}>{t("contact")}</button>
        <button onClick={() => onNavigate("privacy")}>{t("privacy")}</button>
        <button onClick={() => onNavigate("terms")}>{t("terms")}</button>
      </div>
      <a
        className="finki-support"
        href="https://finki.ukim.mk"
        target="_blank"
        rel="noreferrer"
      >
        <span>{t("institutionalSupport")}</span>
        <img src="/brand/finki-logo.png" alt={t("finkiName")} />
      </a>
      <small>© 2026 {activeBrand.legalName}</small>
    </footer>
  );
}
