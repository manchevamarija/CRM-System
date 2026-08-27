import bauLogo from "../assets/partners/crm-bau.png";
import digitmakLogo from "../assets/partners/crm-digitmak.svg";
import hpcLogo from "../assets/partners/crm-hpc.png";
import vezilkaLogo from "../assets/partners/crm-vezilka.png";

export type BrandId = "crm" | "bau" | "digitmak" | "vezilka" | "hpc";

export type BrandConfig = {
  id: BrandId;
  name: string;
  legalName: string;
  logo: string;
  footerLogo: string;
  primary: string;
  accent: string;
  surface: string;
  website: string;
  supportEmail: string;
};

const crmLogo = "/brand/crm-system-logo.svg";
const crmFooterLogo = "/brand/crm-system-logo-footer.svg";

export const brands: Record<BrandId, BrandConfig> = {
  crm: {
    id: "crm",
    name: "CRM System",
    legalName: "CRM System",
    logo: crmLogo,
    footerLogo: crmFooterLogo,
    primary: "#23657a",
    accent: "#c58b2a",
    surface: "#f4f8f8",
    website: "https://crm-system.mk",
    supportEmail: "support@crm-system.mk",
  },
  bau: {
    id: "bau",
    name: "BAU",
    legalName: "Business Accelerator UKIM",
    logo: bauLogo,
    footerLogo: bauLogo,
    primary: "#2f2f31",
    accent: "#d2a23a",
    surface: "#f7f5ef",
    website: "https://bau.edu.mk",
    supportEmail: "support@bau.edu.mk",
  },
  digitmak: {
    id: "digitmak",
    name: "DIGITMAK",
    legalName: "European Digital Innovation Hub DIGITMAK",
    logo: digitmakLogo,
    footerLogo: digitmakLogo,
    primary: "#174f67",
    accent: "#d29a2f",
    surface: "#f2f7f8",
    website: "https://digitmak.mk",
    supportEmail: "support@digitmak.mk",
  },
  vezilka: {
    id: "vezilka",
    name: "VEZILKA",
    legalName: "National AI Factory Antenna VEZILKA",
    logo: vezilkaLogo,
    footerLogo: vezilkaLogo,
    primary: "#442b62",
    accent: "#dc8b2c",
    surface: "#f7f3fa",
    website: "https://vezilka.mk",
    supportEmail: "support@vezilka.mk",
  },
  hpc: {
    id: "hpc",
    name: "HPC",
    legalName: "National Competence Centre for HPC, HPDA and AI",
    logo: hpcLogo,
    footerLogo: hpcLogo,
    primary: "#173f5f",
    accent: "#e1912b",
    surface: "#f2f6f9",
    website: "https://hpc.mk",
    supportEmail: "support@hpc.mk",
  },
};

const isBrandId = (value: string): value is BrandId => value in brands;

const brandFromHost = (host: string): BrandId => {
  const normalized = host.toLowerCase();
  if (normalized.includes("digitmak")) return "digitmak";
  if (normalized.includes("vezilka")) return "vezilka";
  if (normalized.includes("bau")) return "bau";
  if (normalized.includes("hpc")) return "hpc";
  return "crm";
};

const configuredId = String(import.meta.env.VITE_BRAND_ID ?? "").toLowerCase();
const resolvedId = isBrandId(configuredId)
  ? configuredId
  : brandFromHost(
      typeof window === "undefined" ? "" : window.location.hostname,
    );
const configured = brands[resolvedId];

export const activeBrand: BrandConfig = {
  ...configured,
  name: import.meta.env.VITE_BRAND_NAME || configured.name,
  legalName: import.meta.env.VITE_BRAND_LEGAL_NAME || configured.legalName,
  logo: import.meta.env.VITE_BRAND_LOGO_URL || configured.logo,
  footerLogo:
    import.meta.env.VITE_BRAND_FOOTER_LOGO_URL || configured.footerLogo,
  primary: import.meta.env.VITE_BRAND_PRIMARY || configured.primary,
  accent: import.meta.env.VITE_BRAND_ACCENT || configured.accent,
  surface: import.meta.env.VITE_BRAND_SURFACE || configured.surface,
  website: import.meta.env.VITE_BRAND_WEBSITE || configured.website,
  supportEmail:
    import.meta.env.VITE_BRAND_SUPPORT_EMAIL || configured.supportEmail,
};

export function applyBrandTheme(brand: BrandConfig = activeBrand) {
  const root = document.documentElement;
  root.dataset.brand = brand.id;
  root.style.setProperty("--brand-red", brand.primary);
  root.style.setProperty("--brand-yellow", brand.accent);
  root.style.setProperty("--brand-blush", brand.surface);
  document.title = `${brand.name} · Digital Service Platform`;
}
