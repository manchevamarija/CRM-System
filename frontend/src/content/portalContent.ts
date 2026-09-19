import type { Language } from "../shared/types";

export const copy = {
  mk: {
    nav: ["Почетна", "Услуги", "Корисничка поддршка", "Контакт"],
    hero: "Забрзана дигитална трансформација со вештачка интелигенција",
    heroLead: "Забрзана дигитална трансформација со",
    heroAccent: "вештачка интелигенција",
    heroSignals: [
      "Центар за корисничка поддршка",
      "Тестирај пред да инвестираш",
      "One-Stop-Shop портал",
    ],
    sub: "Експертска поддршка, тестирање и знаење за сигурен дигитален раст — на едно место.",
    start: "Побарај поддршка",
    explore: "Истражи ги услугите",
    services: "Поддршка создадена за вашиот следен чекор",
    portal: "Мој портал",
    audience: "За компании и јавни институции",
    languages: "јазици",
    supportMonths: "месеци поддршка",
    singlePortal: "единствен портал",
    offerKicker: "ШТО НУДИМЕ",
    offerLead:
      "Од првата идеја до сигурна имплементација — нашиот тим ви помага да донесете подобри дигитални одлуки.",
    learnMore: "Дознај повеќе",
    helpTitle: "Имате прашање?\nЗапочнете со нас.",
    helpLead:
      "Прва линија на практична поддршка за вашите деловни и дигитални предизвици.",
    openTicket: "Отвори тикет",
  },
  en: {
    nav: ["Home", "Services", "Customer Support", "Contact"],
    hero: "Accelerated digital transformation with artificial intelligence",
    heroLead: "Accelerated digital transformation with",
    heroAccent: "artificial intelligence",
    heroSignals: [
      "Customer support centre",
      "Test before invest",
      "One-Stop-Shop portal",
    ],
    sub: "Expert support, testing and knowledge for confident digital growth — all in one place.",
    start: "Request support",
    explore: "Explore services",
    services: "Support built for your next step",
    portal: "My portal",
    audience: "For companies and public institutions",
    languages: "languages",
    supportMonths: "months of support",
    singlePortal: "single portal",
    offerKicker: "WHAT WE OFFER",
    offerLead:
      "From the first idea to secure implementation — our team helps you make better digital decisions.",
    learnMore: "Learn more",
    helpTitle: "Have a question?\nStart with us.",
    helpLead:
      "A practical first line of support for your business and digital challenges.",
    openTicket: "Open a ticket",
  },
  sq: {
    nav: ["Ballina", "Shërbimet", "Mbështetja e klientëve", "Kontakt"],
    hero: "Transformim digjital i përshpejtuar me inteligjencë artificiale",
    heroLead: "Transformim digjital i përshpejtuar me",
    heroAccent: "inteligjencë artificiale",
    heroSignals: [
      "Qendra e mbështetjes së klientëve",
      "Testo para investimit",
      "Portali One-Stop-Shop",
    ],
    sub: "Mbështetje profesionale, testim dhe njohuri për rritje të sigurt digjitale — në një vend.",
    start: "Kërko mbështetje",
    explore: "Shiko shërbimet",
    services: "Mbështetje për hapin tuaj të ardhshëm",
    portal: "Portali im",
    audience: "Për kompani dhe institucione publike",
    languages: "gjuhë",
    supportMonths: "muaj mbështetje",
    singlePortal: "portal i vetëm",
    offerKicker: "ÇFARË OFROJMË",
    offerLead:
      "Nga ideja e parë deri te zbatimi i sigurt — ekipi ynë ju ndihmon të merrni vendime më të mira digjitale.",
    learnMore: "Mëso më shumë",
    helpTitle: "Keni pyetje?\nFilloni me ne.",
    helpLead:
      "Linja e parë e mbështetjes praktike për sfidat tuaja të biznesit dhe ato digjitale.",
    openTicket: "Hap tiketë",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

export const services = {
  mk: [
    [
      "Digital readiness",
      "Проценка на зрелост и план за практично дигитализација.",
      "↗",
    ],
    [
      "Digital compliance",
      "Прва насока за одговорно и усогласено користење технологии.",
      "§",
    ],
    [
      "Test before invest",
      "Пилоти, лаборатории и техничка валидација пред инвестиција.",
      "◇",
    ],
    [
      "Digital roadmap",
      "Јасен патоказ за дигитална трансформација на организацијата.",
      "DM",
    ],
  ],
  en: [
    [
      "Digital readiness",
      "A maturity assessment and plan for practical AI adoption.",
      "↗",
    ],
    [
      "Digital compliance",
      "Initial guidance for responsible and compliant AI use.",
      "§",
    ],
    [
      "Test before invest",
      "Pilots, laboratories and technical validation before investment.",
      "◇",
    ],
    [
      "Digital roadmap",
      "A clear digital transformation roadmap for your organisation.",
      "DM",
    ],
  ],
  sq: [
    [
      "Gatishmëria digjitale",
      "Vlerësim i pjekurisë dhe plan për digjitalizim praktik.",
      "↗",
    ],
    [
      "Pajtueshmëria digjitale",
      "Udhëzim fillestar për përdorim të përgjegjshëm të teknologjisë.",
      "§",
    ],
    [
      "Testo para investimit",
      "Pilotë, laboratorë dhe validim teknik para investimit.",
      "◇",
    ],
    [
      "Udhërrëfyes digjital",
      "Udhërrëfyes i qartë për transformimin digjital të organizatës.",
      "DM",
    ],
  ],
} as const;
