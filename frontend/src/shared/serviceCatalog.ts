import type { Language } from "./types";

export const crmServiceCatalog = [
  {
    value: "Дигитална стратегија",
    mk: "Дигитална стратегија",
    en: "Digital strategy",
    sq: "Strategji digjitale",
  },
  {
    value: "Веб и е-трговија",
    mk: "Веб и е-трговија",
    en: "Web and e-commerce",
    sq: "Ueb dhe tregti elektronike",
  },
  {
    value: "Автоматизација",
    mk: "Автоматизација",
    en: "Automation",
    sq: "Automatizim",
  },
  {
    value: "Паметни дигитални решенија",
    mk: "Паметни дигитални решенија",
    en: "Smart digital solutions",
    sq: "Zgjidhje të mençura digjitale",
  },
  {
    value: "Дигитален маркетинг",
    mk: "Дигитален маркетинг",
    en: "Digital marketing",
    sq: "Marketing digjital",
  },
  {
    value: "Обуки за тимови",
    mk: "Обуки за тимови",
    en: "Team training",
    sq: "Trajnime për ekipe",
  },
] as const;

export function serviceLabel(
  service: (typeof crmServiceCatalog)[number],
  language: Language,
) {
  return service[language];
}
