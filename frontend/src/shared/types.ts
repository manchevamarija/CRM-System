export type Language = "mk" | "en" | "sq";
export type View =
  | "home"
  | "services"
  | "help"
  | "contact"
  | "training"
  | "register"
  | "forgot"
  | "reset"
  | "change-password"
  | "verify"
  | "organization"
  | "subscription-invite"
  | "privacy"
  | "terms"
  | "dashboard"
  | "staff"
  | "admin"
  | "platform-admin";
export type Navigate = (
  view: View,
  options?: { tab?: string; ticket?: string; org?: string },
) => void;
