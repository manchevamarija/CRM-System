import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  mk: {
    translation: {
      home: "Почетна",
      services: "Услуги",
      training: "Обуки",
      help: "Поддршка",
      contact: "Контакт",
      portal: "Мој портал",
      privacy: "Приватност",
      terms: "Услови",
      tagline: "Европски центар за дигитални иновации за Северна Македонија.",
      notifications: "Известувања",
      noNotifications: "Нема известувања.",
      institutionalSupport: "Институционална поддршка",
      finkiName:
        "ФИНКИ — Факултет за информатички науки и компјутерско инженерство",
    },
  },
  en: {
    translation: {
      home: "Home",
      services: "Services",
      training: "Training",
      help: "Support",
      contact: "Contact",
      portal: "My portal",
      privacy: "Privacy",
      terms: "Terms",
      tagline: "European Digital Innovation Hub for North Macedonia.",
      notifications: "Notifications",
      noNotifications: "No notifications.",
      institutionalSupport: "Institutional support",
      finkiName: "FCSE — Faculty of Computer Science and Engineering",
    },
  },
  sq: {
    translation: {
      home: "Ballina",
      services: "Shërbimet",
      training: "Trajnime",
      help: "Mbështetje",
      contact: "Kontakt",
      portal: "Portali im",
      privacy: "Privatësia",
      terms: "Kushtet",
      tagline:
        "Qendra Evropiane për Inovacion Digjital për Maqedoninë e Veriut.",
      notifications: "Njoftimet",
      noNotifications: "Nuk ka njoftime.",
      institutionalSupport: "Mbështetje institucionale",
      finkiName: "FINKI — Fakulteti i Shkencave Kompjuterike dhe Inxhinierisë",
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng:
    typeof window !== "undefined" &&
    typeof window.localStorage?.getItem === "function"
      ? (window.localStorage.getItem("crm-system.language") ?? "mk")
      : "mk",
  fallbackLng: "mk",
  interpolation: { escapeValue: false },
});
export default i18n;
