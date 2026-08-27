import bau from "../../assets/partners/crm-bau.png";
import digitmak from "../../assets/partners/crm-digitmak.svg";
import hpc from "../../assets/partners/crm-hpc.png";
import vezilka from "../../assets/partners/crm-vezilka.png";
import type { Language } from "../../shared/types";

const copy = {
  mk: {
    kicker: "НАШИТЕ ПАРТНЕРИ",
    title: "Заедно ја градиме дигиталната иднина.",
    lead: "Четири поврзани иницијативи за дигитализација, претприемништво, вештачка интелигенција и високоперформансно пресметување.",
    partner: "ПАРТНЕР",
    coordinator: "КООРДИНАТОР",
  },
  en: {
    kicker: "OUR PARTNERS",
    title: "Building the digital future together.",
    lead: "Four connected initiatives spanning digitalisation, entrepreneurship, artificial intelligence and high-performance computing.",
    partner: "PARTNER",
    coordinator: "COORDINATOR",
  },
  sq: {
    kicker: "PARTNERËT TANË",
    title: "Së bashku ndërtojmë të ardhmen digjitale.",
    lead: "Katër iniciativa të lidhura për digjitalizim, sipërmarrje, inteligjencë artificiale dhe përpunim me performancë të lartë.",
    partner: "PARTNER",
    coordinator: "KOORDINATOR",
  },
} as const;

const partners = [
  {
    image: digitmak,
    href: "https://digitmak.mk/",
    names: {
      mk: "DIGITMAK — Европски центар за дигитални иновации",
      en: "DIGITMAK — European Digital Innovation Hub",
      sq: "DIGITMAK — Qendra Evropiane e Inovacionit Digjital",
    },
  },
  {
    image: bau,
    href: "https://bauaccelerator.com/",
    names: {
      mk: "BAU — Бизнис акцелератор УКИМ",
      en: "BAU — Business Accelerator UKIM",
      sq: "BAU — Përshpejtuesi i Biznesit UKIM",
    },
  },
  {
    image: vezilka,
    href: "https://vezilka.ai/",
    names: {
      mk: "VEZILKA — Национална фабрика за вештачка интелигенција",
      en: "VEZILKA — National AI Factory Antenna",
      sq: "VEZILKA — Fabrika Kombëtare e Inteligjencës Artificiale",
    },
  },
  {
    image: hpc,
    href: "https://www.hpc.mk/",
    names: {
      mk: "HPC — Национален центар за HPC, HPDA и AI",
      en: "HPC — National Competence Centre for HPC, HPDA and AI",
      sq: "HPC — Qendra Kombëtare e Kompetencës për HPC, HPDA dhe AI",
    },
  },
] as const;

export function PartnersSection({ language }: { language: Language }) {
  const text = copy[language];
  return (
    <section className="partners-section" aria-labelledby="partners-title">
      <header className="partners-heading">
        <div>
          <span className="kicker">{text.kicker}</span>
          <h2 id="partners-title">{text.title}</h2>
        </div>
        <p>{text.lead}</p>
      </header>
      <div className="partner-grid">
        {partners.map((partner, index) => (
          <a
            key={partner.href}
            className="partner-card"
            href={partner.href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="partner-index">0{index + 1}</span>
            <div className="partner-logo">
              <img src={partner.image} alt="" loading="lazy" />
            </div>
            <h3>{partner.names[language]}</h3>
            <span className="partner-role">{text.partner}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
