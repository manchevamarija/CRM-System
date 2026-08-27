import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api";
import { copy, services } from "../../content/portalContent";
import { useAuth } from "../../features/auth/useAuth";
import { uiCopy } from "../../content/uiCopy";
import { usePortalLanguage } from "../../shared/usePortalLanguage";
import type { Language, Navigate } from "../../shared/types";
import { PartnersSection } from "../../components/partners/PartnersSection";

export function HomePage({
  language,
  onNavigate,
}: {
  language: Language;
  onNavigate: Navigate;
}) {
  const t = copy[language];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> European Digital Innovation Hub
          </div>
          <h1>
            {t.heroLead} <em>{t.heroAccent}</em>
          </h1>
          <p>{t.sub}</p>
          <div className="actions">
            <button className="primary" onClick={() => onNavigate("contact")}>
              {t.start}
            </button>
            <button
              className="secondary"
              onClick={() => onNavigate("services")}
            >
              {t.explore}
            </button>
          </div>
        </div>
        <div className="hero-network" aria-hidden="true">
          <span className="network-core">CRM</span>
          <i className="network-node node-one" />
          <i className="network-node node-two" />
          <i className="network-node node-three" />
          {(t.heroSignals as string[]).map((signal, index) => (
            <div className={`hero-signal signal-${index + 1}`} key={signal}>
              <span>{index === 0 ? "☏" : index === 1 ? "T" : "1"}</span>
              {signal}
            </div>
          ))}
        </div>
      </section>
      <section className="trust">
        <span>{t.audience}</span>
        <div>
          <b>3</b> {t.languages}
        </div>
        <div>
          <b>12</b> {t.supportMonths}
        </div>
        <div>
          <b>1</b> {t.singlePortal}
        </div>
      </section>
      <section className="service-section">
        <div className="section-head">
          <div>
            <span className="kicker">{t.offerKicker}</span>
            <h2>{t.services}</h2>
          </div>
          <p>{t.offerLead}</p>
        </div>
        <ServiceCards language={language} onNavigate={onNavigate} />
      </section>
      <PartnersSection language={language} />
      <section className="help-strip">
        <div>
          <span className="live" /> CRM SYSTEM ПОДДРШКА
        </div>
        <h2>
          {t.helpTitle.split("\n").map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </h2>
        <p>{t.helpLead}</p>
        <button className="light" onClick={() => onNavigate("register")}>
          {t.openTicket}
        </button>
      </section>
    </>
  );
}

function ServiceCards({
  onNavigate,
  language,
  wide = false,
}: {
  onNavigate: Navigate;
  language: Language;
  wide?: boolean;
}) {
  const t = copy[language];
  const baseServices = services[language];
  const items = wide
    ? [
        ...baseServices,
        [
          "Data governance",
          language === "mk"
            ? "Подобри податоци, приватност и управување."
            : language === "sq"
              ? "Të dhëna, privatësi dhe menaxhim më i mirë."
              : "Better data, privacy and governance.",
          "◎",
        ] as const,
        [
          "Training & skills",
          language === "mk"
            ? "Обуки и ресурси приспособени на вашиот тим."
            : language === "sq"
              ? "Trajnime dhe burime të përshtatura për ekipin tuaj."
              : "Training and resources tailored to your team.",
          "+",
        ] as const,
      ]
    : baseServices;
  return (
    <div className={`cards${wide ? " wide" : ""}`}>
      {items.map((service, index) => (
        <article key={service[0]}>
          <span className="num">0{index + 1}</span>
          <div className="icon">{service[2]}</div>
          <h3>{service[0]}</h3>
          <p>{service[1]}</p>
          <button onClick={() => onNavigate(wide ? "contact" : "services")}>
            {wide
              ? language === "mk"
                ? "Побарај консултација"
                : language === "sq"
                  ? "Kërko konsultim"
                  : "Request a consultation"
              : t.learnMore}
          </button>
        </article>
      ))}
    </div>
  );
}

export function ServicesPage({ onNavigate }: { onNavigate: Navigate }) {
  const language = usePortalLanguage();
  const tx = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  return (
    <section className="page">
      <span className="kicker">
        {tx("КАТАЛОГ НА УСЛУГИ", "SERVICE CATALOGUE", "KATALOGU I SHËRBIMEVE")}
      </span>
      <h1>
        {tx(
          "Знаење што се претвора во напредок.",
          "Knowledge transformed into progress.",
          "Njohuri që shndërrohen në përparim.",
        )}
      </h1>
      <p className="lead">
        {tx(
          "Практична експертска поддршка за компаниите и јавните институции во Северна Македонија.",
          "Practical expert support for companies and public institutions in North Macedonia.",
          "Mbështetje praktike profesionale për kompanitë dhe institucionet publike në Maqedoninë e Veriut.",
        )}
      </p>
      <ServiceCards language={language} onNavigate={onNavigate} wide />
    </section>
  );
}

export function HelpDeskPage({ onNavigate }: { onNavigate: Navigate }) {
  const { login } = useAuth();
  const language = usePortalLanguage();
  const t = uiCopy[language].help;
  const tx = (mk: string, en: string, sq: string) =>
    language === "en" ? en : language === "sq" ? sq : mk;
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      const signedInUser = await login(
        String(data.get("email")),
        String(data.get("password")),
      );
      onNavigate(
        signedInUser.mustChangePassword
          ? "change-password"
          : signedInUser.roles.includes("Admin")
            ? "admin"
            : sessionStorage.getItem("crm-system.subscriptionToken")
              ? "subscription-invite"
              : "dashboard",
      );
    } catch (value) {
      if (value instanceof ApiError && value.status === 401)
        setError(t.invalidCredentials);
      else if (
        value instanceof ApiError &&
        (value.status === 0 || value.status >= 500)
      )
        setError(t.serverUnavailable);
      else if (value instanceof ApiError && value.status === 403)
        setError(t.accountUnavailable);
      else setError(value instanceof Error ? value.message : t.error);
    }
  };
  return (
    <div className="ai-contact-page">
      <section className="ai-contact-hero">
        <div className="ai-contact-copy">
          <span className="kicker">
            <i />{" "}
            {tx(
              "СТРУЧНА ПОДДРШКА · CRM SYSTEM",
              "EXPERT SUPPORT · CRM SYSTEM",
              "MBËSHTETJE PROFESIONALE · CRM SYSTEM",
            )}
          </span>
          <h1>
            {tx("Од прашање до", "From a question to a", "Nga pyetja te një")}{" "}
            <em>
              {tx(
                "практично решение.",
                "practical solution.",
                "zgjidhje praktike.",
              )}
            </em>
          </h1>
          <p>
            {tx(
              "Најавете се за да ги следите вашите барања, статуси, документи и разговори со CRM System тимот — сè на едно место.",
              "Sign in to track your requests, statuses, documents and conversations with the CRM System team — all in one place.",
              "Kyçuni për të ndjekur kërkesat, statuset, dokumentet dhe bisedat me ekipin CRM System — të gjitha në një vend.",
            )}
          </p>
          <div className="actions">
            <button className="primary" onClick={() => onNavigate("contact")}>
              {tx(
                "Испратете ново барање",
                "Submit a new request",
                "Dërgoni kërkesë të re",
              )}{" "}
              <span>→</span>
            </button>
            <button
              className="ai-text-button"
              onClick={() => onNavigate("services")}
            >
              {tx(
                "Истражете ги услугите",
                "Explore services",
                "Eksploroni shërbimet",
              )}
            </button>
          </div>
          <div className="ai-contact-trust">
            <span>
              <b>01</b> {tx("Без обврска", "No obligation", "Pa detyrim")}
            </span>
            <span>
              <b>02</b>{" "}
              {tx(
                "Одговор до 2 дена",
                "Reply within 2 days",
                "Përgjigje brenda 2 ditëve",
              )}
            </span>
            <span>
              <b>03</b>{" "}
              {tx(
                "Локален експертски тим",
                "Local expert team",
                "Ekip lokal ekspertësh",
              )}
            </span>
          </div>
        </div>
        <form className="support-login-card" onSubmit={submit}>
          <div className="support-login-head">
            <span>
              {tx("БЕЗБЕДЕН ПРИСТАП", "SECURE ACCESS", "QASJE E SIGURT")}
            </span>
            <small>
              {tx(
                "ЗА РЕГИСТРИРАНИ КОРИСНИЦИ",
                "FOR REGISTERED USERS",
                "PËR PËRDORUES TË REGJISTRUAR",
              )}
            </small>
          </div>
          <h2>
            {tx(
              "Најавете се во порталот",
              "Sign in to the portal",
              "Kyçuni në portal",
            )}
          </h2>
          <p>
            {tx(
              "Продолжете таму каде што застанавте.",
              "Continue where you left off.",
              "Vazhdoni aty ku e latë.",
            )}
          </p>
          <label>
            {tx("Е-пошта", "Email", "Email")}
            <input
              name="email"
              required
              type="email"
              placeholder="ime@kompanija.mk"
              autoComplete="email"
            />
          </label>
          <label>
            {tx("Лозинка", "Password", "Fjalëkalimi")}
            <input
              name="password"
              required
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary">
            {tx("Најави се", "Sign in", "Kyçu")} <span>→</span>
          </button>
          <div className="support-login-links">
            <span>
              {tx("Немате сметка?", "No account?", "Nuk keni llogari?")}{" "}
              <button type="button" onClick={() => onNavigate("register")}>
                {tx("Регистрирајте се", "Register", "Regjistrohuni")}
              </button>
            </span>
            <button type="button" onClick={() => onNavigate("forgot")}>
              {tx(
                "Заборавена лозинка?",
                "Forgot password?",
                "Keni harruar fjalëkalimin?",
              )}
            </button>
          </div>
          <div className="secure-note">
            <span>✓</span>
            <small>
              {tx(
                "Вашите податоци се заштитени и се користат само за пристап до порталот.",
                "Your data is protected and used only to access the portal.",
                "Të dhënat tuaja mbrohen dhe përdoren vetëm për qasje në portal.",
              )}
            </small>
          </div>
        </form>
      </section>
      <section className="ai-contact-services">
        <div className="section-head">
          <div>
            <span className="kicker">
              {tx(
                "КАКО МОЖЕМЕ ДА ПОМОГНЕМЕ",
                "HOW WE CAN HELP",
                "SI MUND TË NDIHMOJMË",
              )}
            </span>
            <h2>
              {tx(
                "Поддршка што создава реална вредност.",
                "Support that creates real value.",
                "Mbështetje që krijon vlerë reale.",
              )}
            </h2>
          </div>
          <p>
            {tx(
              "Не започнуваме од технологијата, туку од вашиот деловен предизвик.",
              "We start with your business challenge, not the technology.",
              "Fillojmë nga sfida juaj e biznesit, jo nga teknologjia.",
            )}
          </p>
        </div>
        <div className="ai-benefit-grid">
          <article>
            <span>✦</span>
            <small>01</small>
            <h3>
              {tx(
                "Дигитална проценка",
                "Digital assessment",
                "Vlerësim digjital",
              )}
            </h3>
            <p>
              {tx(
                "Ги откриваме процесите каде технологијата може да заштеди време, трошоци и рачна работа.",
                "We identify processes where technology can save time, costs and manual work.",
                "Identifikojmë proceset ku teknologjia kursen kohë, kosto dhe punë manuale.",
              )}
            </p>
          </article>
          <article>
            <span>⌁</span>
            <small>02</small>
            <h3>
              {tx(
                "Паметна автоматизација",
                "Smart automation",
                "Automatizim inteligjent",
              )}
            </h3>
            <p>
              {tx(
                "Дизајнираме практични решенија што се вклопуваат во вашите постојни системи.",
                "We design practical solutions that fit your existing systems.",
                "Dizajnojmë zgjidhje praktike që përshtaten me sistemet tuaja.",
              )}
            </p>
          </article>
          <article>
            <span>◎</span>
            <small>03</small>
            <h3>
              {tx(
                "Податоци и усогласеност",
                "Data and compliance",
                "Të dhëna dhe pajtueshmëri",
              )}
            </h3>
            <p>
              {tx(
                "Безбедно користење податоци со јасни правила, приватност и регулаторни насоки.",
                "Secure data use with clear rules, privacy and regulatory guidance.",
                "Përdorim i sigurt i të dhënave me rregulla, privatësi dhe udhëzime rregullatore.",
              )}
            </p>
          </article>
        </div>
      </section>
      <section className="ai-contact-steps">
        <span className="kicker">
          {tx("ЕДНОСТАВЕН ПРОЦЕС", "A SIMPLE PROCESS", "PROCES I THJESHTË")}
        </span>
        <h2>
          {tx(
            "Од првиот контакт до решение.",
            "From first contact to solution.",
            "Nga kontakti i parë te zgjidhja.",
          )}
        </h2>
        <div>
          {[
            tx("Изберете ги услугите", "Choose services", "Zgjidhni shërbimet"),
            tx(
              "Опишете го предизвикот",
              "Describe the challenge",
              "Përshkruani sfidën",
            ),
            tx(
              "Разговарајте со експерт",
              "Talk to an expert",
              "Bisedoni me ekspert",
            ),
            tx(
              "Добијте план и понуда",
              "Receive a plan and offer",
              "Merrni planin dhe ofertën",
            ),
          ].map((step, index) => (
            <article key={step}>
              <i>0{index + 1}</i>
              <b>{step}</b>
            </article>
          ))}
        </div>
        <button className="primary" onClick={() => onNavigate("contact")}>
          {tx("Испратете барање", "Submit request", "Dërgoni kërkesën")}{" "}
          <span>→</span>
        </button>
      </section>
    </div>
  );
}

export function ContactPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/api/public/contact-requests", {
        method: "POST",
        body: JSON.stringify({
          organizationName: data.get("organization"),
          organizationType: data.get("organizationType"),
          contactName: data.get("contactName"),
          email: data.get("email"),
          mainNeed: data.get("mainNeed"),
          challengeDescription: data.get("challenge"),
          consentToContact: true,
          privacyPolicyAccepted: true,
        }),
      });
      setSent(true);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Барањето не може да се испрати.",
      );
    }
  };
  return (
    <section className="page contact">
      <div>
        <span className="kicker">КОНТАКТ</span>
        <h1>Кажете ни што сакате да постигнете.</h1>
        <p className="lead">
          Кратка почетна проценка — нашиот тим ќе ви одговори со соодветен
          следен чекор.
        </p>
        <div className="contact-meta">
          <p>Одговор во рок од 2 работни дена</p>
          <p>Достапно на македонски, англиски и албански</p>
        </div>
      </div>
      {sent ? (
        <div className="success">
          <b>✓</b>
          <h2>Барањето е примено.</h2>
          <p>Нашиот тим ќе ве контактира наскоро.</p>
          <button className="secondary" onClick={() => setSent(false)}>
            Ново барање
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="row">
            <label>
              Организација
              <input
                name="organization"
                required
                placeholder="Име на организација"
              />
            </label>
            <label>
              Тип
              <select name="organizationType" required>
                <option>МСП</option>
                <option>Јавна институција</option>
                <option>Партнер</option>
                <option>Друго</option>
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              Име и презиме
              <input name="contactName" required />
            </label>
            <label>
              Е-пошта
              <input name="email" required type="email" />
            </label>
          </div>
          <label>
            Главна потреба
            <select name="mainNeed">
              <option>Вештачка интелигенција</option>
              <option>Дигитализација</option>
              <option>Обука</option>
              <option>Финансирање</option>
              <option>Test-before-invest</option>
            </select>
          </label>
          <label>
            Предизвик
            <textarea
              name="challenge"
              required
              rows={5}
              placeholder="Опишете го вашиот деловен или јавен предизвик..."
            />
          </label>
          <label className="check">
            <input required type="checkbox" /> Се согласувам да бидам
            контактиран/а и ја прифаќам политиката за приватност.
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary">Испрати барање</button>
        </form>
      )}
    </section>
  );
}
