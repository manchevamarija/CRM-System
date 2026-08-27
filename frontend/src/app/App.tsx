import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { Footer } from "../components/layout/Footer";
import { Header } from "../components/layout/Header";
import { HelpDeskPage, HomePage } from "../pages/public/PublicPages";
import { useAuth } from "../features/auth/useAuth";
import type { Language, View } from "../shared/types";
import type { Tab as AdminTab } from "../pages/admin/AdminDashboardPage";
import type { Tab as ClientTab } from "../pages/client/ClientDashboardPage";

const AdminDashboardPage = lazy(() =>
  import("../pages/admin/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const PlatformAdminDashboardPage = lazy(() =>
  import("../pages/platform/PlatformAdminDashboardPage").then((module) => ({
    default: module.PlatformAdminDashboardPage,
  })),
);
const ClientDashboardPage = lazy(() =>
  import("../pages/client/ClientDashboardPage").then((module) => ({
    default: module.ClientDashboardPage,
  })),
);
const StaffDashboardPage = lazy(() =>
  import("../pages/staff/StaffDashboardPage").then((module) => ({
    default: module.StaffDashboardPage,
  })),
);
const DmaContactPage = lazy(() =>
  import("../pages/public/DmaContactPage").then((module) => ({
    default: module.DmaContactPage,
  })),
);
const TranslatedServicesPage = lazy(() =>
  import("../pages/public/TranslatedServicesPage").then((module) => ({
    default: module.TranslatedServicesPage,
  })),
);
const TrainingPage = lazy(() =>
  import("../pages/public/TrainingPage").then((module) => ({
    default: module.TrainingPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../pages/auth/AuthPages").then((module) => ({
    default: module.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/auth/AuthPages").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/auth/AuthPages").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const ChangePasswordPage = lazy(() =>
  import("../pages/auth/AuthPages").then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import("../pages/auth/AuthPages").then((module) => ({
    default: module.VerifyEmailPage,
  })),
);
const OrganizationOnboardingPage = lazy(() =>
  import("../pages/client/OrganizationOnboardingPage").then((module) => ({
    default: module.OrganizationOnboardingPage,
  })),
);
const SubscriptionInvitePage = lazy(() =>
  import("../pages/client/SubscriptionInvitePage").then((module) => ({
    default: module.SubscriptionInvitePage,
  })),
);
const PrivacyPage = lazy(() =>
  import("../pages/public/CompliancePages").then((module) => ({
    default: module.PrivacyPage,
  })),
);
const TermsPage = lazy(() =>
  import("../pages/public/CompliancePages").then((module) => ({
    default: module.TermsPage,
  })),
);

function AuthCheckingPlaceholder() {
  return (
    <section className="page" style={{ minHeight: "60vh" }} aria-busy="true" />
  );
}

const routes: Record<View, string> = {
  home: "/",
  services: "/services",
  training: "/training",
  help: "/help-desk",
  contact: "/contact",
  register: "/register",
  forgot: "/forgot-password",
  reset: "/reset-password",
  "change-password": "/change-password",
  verify: "/verify-email",
  organization: "/organization",
  "subscription-invite": "/subscription-invite",
  privacy: "/privacy",
  terms: "/terms",
  dashboard: "/portal",
  staff: "/staff",
  admin: "/admin",
  "platform-admin": "/platform-admin",
};
const views = Object.fromEntries(
  Object.entries(routes).map(([view, path]) => [path, view]),
) as Record<string, View>;

export default function App() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>(
    () =>
      (typeof window.localStorage?.getItem === "function"
        ? (window.localStorage.getItem("crm-system.language") as Language)
        : null) || "mk",
  );
  const legacy = new URLSearchParams(location.search).get(
    "view",
  ) as View | null;
  const view = views[location.pathname] ?? legacy ?? "home";
  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword && view !== "change-password") {
      navigate(routes["change-password"], { replace: true });
      return;
    }
    const hasStaffAccess = user.roles.some((role) =>
      ["HelpDeskAgent", "Expert", "Admin", "PlatformAdmin"].includes(role),
    );
    if (view === "platform-admin" && !user.roles.includes("PlatformAdmin"))
      navigate(routes.dashboard, { replace: true });
    if (view === "staff" && !hasStaffAccess)
      navigate(routes.dashboard, { replace: true });
    if (
      view === "admin" &&
      !user.roles.some((role) => ["Admin", "PlatformAdmin"].includes(role))
    )
      navigate(routes.dashboard, { replace: true });
    if (view === "dashboard" && user.roles.includes("PlatformAdmin"))
      navigate(routes["platform-admin"], { replace: true });
    if (
      view === "dashboard" &&
      !user.roles.includes("PlatformAdmin") &&
      user.roles.includes("Admin")
    )
      navigate(routes.admin, { replace: true });
    if (
      view === "contact" &&
      user.roles.some((role) => ["Admin", "PlatformAdmin"].includes(role))
    )
      navigate("/admin?tab=contacts", { replace: true });
  }, [navigate, user, view]);
  const requestedClientTab = new URLSearchParams(location.search).get("tab");
  const clientInitialTab = (
    [
      "overview",
      "crm",
      "organization",
      "contacts",
      "tickets",
      "meetings",
      "notifications",
      "profile",
    ] as const
  ).includes(requestedClientTab as ClientTab)
    ? (requestedClientTab as ClientTab)
    : undefined;
  const go = (next: View, options?: { tab?: string; ticket?: string }) =>
    navigate({
      pathname: routes[next],
      search: options
        ? `?${new URLSearchParams(
            Object.fromEntries(
              Object.entries(options).filter((entry) => Boolean(entry[1])),
            ) as Record<string, string>,
          ).toString()}`
        : "",
    });
  return (
    <div className="app">
      <Header
        language={language}
        view={view}
        onLanguage={setLanguage}
        onNavigate={go}
      />
      <main>
        <Suspense fallback={<AuthCheckingPlaceholder />}>
          {view === "home" && <HomePage language={language} onNavigate={go} />}
          {view === "services" && <TranslatedServicesPage onNavigate={go} />}
          {view === "training" && <TrainingPage onNavigate={go} />}
          {view === "help" && <HelpDeskPage onNavigate={go} />}
          {view === "contact" && <DmaContactPage onNavigate={go} />}
          {view === "register" && <RegisterPage onNavigate={go} />}
          {view === "forgot" && <ForgotPasswordPage onNavigate={go} />}
          {view === "reset" && <ResetPasswordPage onNavigate={go} />}
          {view === "change-password" && <ChangePasswordPage onNavigate={go} />}
          {view === "verify" && <VerifyEmailPage onNavigate={go} />}
          {view === "organization" && (
            <OrganizationOnboardingPage onNavigate={go} />
          )}
          {view === "subscription-invite" && (
            <SubscriptionInvitePage onNavigate={go} />
          )}
          {view === "privacy" && <PrivacyPage />}
          {view === "terms" && <TermsPage />}
          {view === "dashboard" &&
            (isLoading ? (
              <AuthCheckingPlaceholder />
            ) : isAuthenticated ? (
              <ClientDashboardPage
                onNavigate={go}
                initialTab={clientInitialTab}
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
              />
            ) : (
              <HelpDeskPage onNavigate={go} />
            ))}
          {view === "staff" &&
            (isLoading ? (
              <AuthCheckingPlaceholder />
            ) : isAuthenticated &&
              user?.roles.some((role) =>
                ["HelpDeskAgent", "Expert", "Admin", "PlatformAdmin"].includes(
                  role,
                ),
              ) ? (
              <StaffDashboardPage
                onNavigate={go}
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
              />
            ) : isAuthenticated ? (
              <ClientDashboardPage
                onNavigate={go}
                initialTab={clientInitialTab}
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
              />
            ) : (
              <HelpDeskPage onNavigate={go} />
            ))}
          {view === "admin" &&
            (isLoading ? (
              <AuthCheckingPlaceholder />
            ) : isAuthenticated && user?.roles.includes("Admin") ? (
              <AdminDashboardPage
                onNavigate={go}
                initialTab={
                  (
                    [
                      "overview",
                      "myNotifications",
                      "organizations",
                      "changes",
                      "subscriptions",
                      "contacts",
                      "tickets",
                      "meetings",
                      "documents",
                      "users",
                      "content",
                      "reports",
                      "evidence",
                      "settings",
                      "notifications",
                      "audit",
                    ] as const
                  ).includes(
                    new URLSearchParams(location.search).get("tab") as AdminTab,
                  )
                    ? (new URLSearchParams(location.search).get(
                        "tab",
                      ) as AdminTab)
                    : undefined
                }
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
                initialOrganizationId={
                  new URLSearchParams(location.search).get("org") ?? undefined
                }
              />
            ) : isAuthenticated ? (
              <ClientDashboardPage
                onNavigate={go}
                initialTab={clientInitialTab}
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
              />
            ) : (
              <HelpDeskPage onNavigate={go} />
            ))}
          {view === "platform-admin" &&
            (isLoading ? (
              <AuthCheckingPlaceholder />
            ) : isAuthenticated && user?.roles.includes("PlatformAdmin") ? (
              <PlatformAdminDashboardPage onNavigate={go} />
            ) : isAuthenticated ? (
              <ClientDashboardPage
                onNavigate={go}
                initialTab={clientInitialTab}
                initialTicketId={
                  new URLSearchParams(location.search).get("ticket") ??
                  undefined
                }
              />
            ) : (
              <HelpDeskPage onNavigate={go} />
            ))}
        </Suspense>
      </main>
      <Footer onNavigate={go} />
    </div>
  );
}
