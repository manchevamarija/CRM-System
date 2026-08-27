import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../features/auth/useAuth";
import type { Navigate } from "../../shared/types";
import { usePortalLanguage } from "../../shared/usePortalLanguage";

import { services, translations } from "./dmaContactContent";

type CreatedRequest = { id: string; status: string };

export function DmaContactPage({ onNavigate }: { onNavigate?: Navigate }) {
  const language = usePortalLanguage();
  const rootRef = useRef<HTMLElement>(null);
  const { user, login } = useAuth();
  const [requestType, setRequestType] = useState<
    "Consultation" | "Partnership"
  >("Consultation");
  const [selected, setSelected] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedRequest>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [applicant, setApplicant] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [creatingProfile, setCreatingProfile] = useState(false);
  const translate = (source: string) =>
    language === "mk" ? source : (translations[language][source] ?? source);

  useEffect(() => {
    if (!rootRef.current) return;
    const sourceKeys = new Set([
      ...Object.keys(translations.en),
      ...Object.keys(translations.sq),
    ]);
    const replacements = [...sourceKeys]
      .flatMap((source) => {
        const target =
          language === "mk"
            ? source
            : (translations[language][source] ?? source);
        return [source, translations.en[source], translations.sq[source]]
          .filter((variant): variant is string => Boolean(variant))
          .map((variant) => [variant, target] as const);
      })
      .sort(([left], [right]) => right.length - left.length);
    const walker = document.createTreeWalker(
      rootRef.current,
      NodeFilter.SHOW_TEXT,
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue ?? "";
      let translated = raw;
      for (const [source, target] of replacements)
        translated = translated.replaceAll(source, target);
      if (translated !== raw) node.nodeValue = translated;
    }
  }, [
    language,
    selected,
    requestType,
    created,
    sending,
    creatingProfile,
    error,
  ]);
  const selectedNames = useMemo(
    () =>
      services
        .filter((service) => selected.includes(service.id))
        .map((service) => service.title),
    [selected],
  );

  const toggleService = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected.length) {
      setError(translate("Изберете најмалку една услуга за вашата кошничка."));
      return;
    }
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim() || null;
    setSending(true);
    setError("");
    try {
      const result = await api<CreatedRequest>("/api/public/contact-requests", {
        method: "POST",
        body: JSON.stringify({
          requestType,
          organizationName: value("organization"),
          organizationType: value("organizationType") ?? "SME",
          taxNumber: value("taxNumber"),
          registrationNumber: value("registrationNumber"),
          address: value("address"),
          sector: value("sector"),
          municipality: value("municipality"),
          region: value("region"),
          website: value("website"),
          contactName: value("contactName"),
          email: value("email"),
          phone: value("phone"),
          preferredLanguage: language,
          employeeCount: value("employeeCount")
            ? Number(value("employeeCount"))
            : null,
          digitalMaturityRating: Number(value("digitalMaturityRating") ?? 3),
          dmaCategory: "DIGITAL_READINESS",
          mainNeed: selected[0],
          challengeDescription: value("challenge"),
          currentTools: value("currentTools"),
          currentDataSources: null,
          usesAi: selected.includes("ai"),
          aiUseCase: null,
          privacyConcerns: null,
          interestedInAiActGuidance: false,
          trainingNeeds: selected.includes("training") ? "Обука за тим" : null,
          desiredTimeline: value("timeline"),
          preferredConsultationFormat: value("consultationFormat"),
          selectedServices: JSON.stringify(selectedNames),
          budgetRange: value("budgetRange"),
          consentToContact: data.get("consent") === "on",
          privacyPolicyAccepted: data.get("privacy") === "on",
        }),
      });
      const fullName = String(value("contactName") ?? "")
        .trim()
        .split(/\s+/);
      setApplicant({
        email: String(value("email") ?? ""),
        firstName: fullName[0] || "Клиент",
        lastName: fullName.slice(1).join(" ") || "CRM",
        phone: String(value("phone") ?? ""),
      });
      setCreated(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate("Барањето не можеше да се испрати. Обидете се повторно."),
      );
    } finally {
      setSending(false);
    }
  };

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!created) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    setCreatingProfile(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...applicant,
          password,
          preferredLanguage: language,
          termsAccepted: true,
          termsVersion: "terms-2026-07-v1",
          privacyVersion: "privacy-2026-07-v1",
          contactRequestId: created.id,
        }),
      });
      await login(applicant.email, password);
      onNavigate?.("dashboard", { tab: "crm" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate("Профилот не можеше да се креира."),
      );
    } finally {
      setCreatingProfile(false);
    }
  };

  if (created)
    return (
      <section className="page crm-success" ref={rootRef}>
        <div className="success-mark">✓</div>
        <span className="kicker">БАРАЊЕТО Е РЕГИСТРИРАНО</span>
        <h1>Барањето е регистрирано.</h1>
        <p className="lead">
          {user
            ? "Вашиот CRM профил и барањето се поврзани. Сите следни чекори можете да ги следите во порталот."
            : "Вашето барање и избраните услуги се внесени во CRM System CRM. Креирајте профил со истата е-пошта за да ги следите статусите и следните чекори."}
        </p>
        <div className="request-reference">
          <span>Референтен број</span>
          <strong>DM-{created.id.slice(0, 8).toUpperCase()}</strong>
          <span className="tag green">Пријавен</span>
        </div>
        <div className="success-service-summary">
          <span className="kicker">Ваши избрани услуги</span>
          <div>
            {selectedNames.map((name) => (
              <span key={name}>
                <i>✓</i> {name}
              </span>
            ))}
          </div>
        </div>
        <div className="crm-timeline compact">
          {[
            "Пријавен",
            "Контактирање",
            "Доделен агент",
            "Потврдени услуги",
            "Во процедура",
            "Follow up",
            "Услужен",
          ].map((item, index) => (
            <div className={index === 0 ? "active" : ""} key={item}>
              <i>{index + 1}</i>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="actions">
          {user ? (
            <button
              className="primary"
              onClick={() => onNavigate?.("dashboard")}
            >
              Отвори го мојот профил
            </button>
          ) : (
            <form className="instant-profile" onSubmit={createProfile}>
              <div>
                <b>Креирајте профил веднаш</b>
                <small>
                  Е-поштата од барањето е веќе внесена. Изберете лозинка и
                  продолжете во порталот.
                </small>
              </div>
              <input
                value={applicant.email}
                readOnly
                aria-label={translate("Е-пошта")}
              />
              <input
                name="password"
                type="password"
                minLength={8}
                required
                placeholder={translate("Изберете лозинка (мин. 8 знаци)")}
                autoComplete="new-password"
              />
              <button className="primary" disabled={creatingProfile}>
                {creatingProfile ? "Се креира…" : "Креирај профил и продолжи"}
              </button>
            </form>
          )}
          <button className="secondary" onClick={() => onNavigate?.("home")}>
            Назад на почетна
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </section>
    );

  return (
    <section className="crm-intake" ref={rootRef}>
      <header className="intake-hero">
        <div>
          <span className="kicker">КОНТАКТ · CRM SYSTEM</span>
          <h1>
            Да создадеме нешто <em>вредно заедно.</em>
          </h1>
          <p>
            Изберете што ви е потребно, составете сопствен пакет на услуги и
            нашиот тим ќе ве контактира со јасен следен чекор.
          </p>
          <div className="intake-promises">
            <span>✓ Без обврска</span>
            <span>✓ Одговор до 2 работни дена</span>
            <span>✓ Персонализирана понуда</span>
          </div>
        </div>
        <aside>
          <small>КАКО ФУНКЦИОНИРА</small>
          <div>
            <i>01</i>
            <span>
              <b>Изберете</b> консултација или соработка
            </span>
          </div>
          <div>
            <i>02</i>
            <span>
              <b>Додадете</b> услуги во кошничката
            </span>
          </div>
          <div>
            <i>03</i>
            <span>
              <b>Испратете</b> и следете го CRM статусот
            </span>
          </div>
        </aside>
      </header>
      <form onSubmit={submit}>
        <section className="intake-section">
          <div className="section-number">01</div>
          <div className="section-copy">
            <h2>Што сакате да започнете?</h2>
            <p>
              Изберете една опција. Формуларот ќе се прилагоди според вашето
              барање.
            </p>
          </div>
          <div className="request-type-grid">
            <button
              type="button"
              className={requestType === "Consultation" ? "selected" : ""}
              onClick={() => setRequestType("Consultation")}
            >
              <span>◌</span>
              <b>Сакам консултација</b>
              <small>Разговор со експерт за предизвик или идеја</small>
            </button>
            <button
              type="button"
              className={requestType === "Partnership" ? "selected" : ""}
              onClick={() => setRequestType("Partnership")}
            >
              <span>◇</span>
              <b>Сакам соработка</b>
              <small>Долгорочно партнерство со CRM System</small>
            </button>
          </div>
        </section>
        <section className="intake-section">
          <div className="section-number">02</div>
          <div className="section-copy">
            <h2>Составете го вашиот пакет</h2>
            <p>
              Изберете ги услугите што ве интересираат. Може да одберете повеќе.
            </p>
          </div>
          <div className="shop-layout">
            <div className="service-picker">
              {services.map((service) => (
                <button
                  type="button"
                  key={service.id}
                  className={selected.includes(service.id) ? "selected" : ""}
                  onClick={() => toggleService(service.id)}
                >
                  <span className="service-icon">{service.icon}</span>
                  <span>
                    <b>{service.title}</b>
                    <small>{service.text}</small>
                  </span>
                  <i>{selected.includes(service.id) ? "✓" : "+"}</i>
                </button>
              ))}
            </div>
            <aside className="service-cart" aria-live="polite">
              <div className="cart-heading">
                <span className="cart-icon" aria-hidden="true">
                  ▤
                </span>
                <span>
                  <small>ИЗБРАНИ УСЛУГИ</small>
                  <b>Вашата кошничка</b>
                </span>
                <i
                  aria-label={`${selected.length} ${translate("избрани услуги")}`}
                >
                  {selected.length}
                </i>
              </div>
              <div
                className={`cart-items ${selected.length ? "has-items" : "is-empty"}`}
              >
                {selected.length ? (
                  services
                    .filter((service) => selected.includes(service.id))
                    .map((service) => (
                      <div className="cart-item" key={service.id}>
                        <span>{service.icon}</span>
                        <b>{service.title}</b>
                        <button
                          type="button"
                          aria-label={`${translate("Отстрани")} ${translate(service.title)}`}
                          onClick={() => toggleService(service.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                ) : (
                  <div className="empty-cart">
                    <span>＋</span>
                    <p>Изберете услуги</p>
                    <small>
                      Додадете ги услугите што ви се потребни од листата.
                    </small>
                  </div>
                )}
              </div>
              <div className="cart-footer">
                <span>Вкупно избрани услуги</span>
                <strong>
                  {selected.length}{" "}
                  {selected.length === 1
                    ? translate("услуга")
                    : translate("услуги")}
                </strong>
              </div>
              <button
                type="button"
                className="primary cart-next"
                disabled={!selected.length}
                onClick={() =>
                  document
                    .getElementById("client-details")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {selected.length
                  ? "Продолжи кон барањето"
                  : "Прво изберете услуга"}{" "}
                <span>→</span>
              </button>
              <small className="cart-note">
                Нема онлајн наплата. По испраќањето, CRM System ќе ве контактира
                со персонализирана понуда.
              </small>
            </aside>
          </div>
        </section>
        <section className="intake-section details-section" id="client-details">
          <div className="section-number">03</div>
          <div className="section-copy">
            <h2>
              {requestType === "Partnership"
                ? "Податоци за соработка"
                : "Кажете ни за вас"}
            </h2>
            <p>Полињата означени со * се задолжителни.</p>
          </div>
          <div className="form-card">
            <h3>Контакт лице</h3>
            <div className="row">
              <label>
                Име и презиме *
                <input
                  name="contactName"
                  required
                  defaultValue={
                    user ? `${user.firstName} ${user.lastName}` : ""
                  }
                />
              </label>
              <label>
                Телефон *
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="+389 7X XXX XXX"
                />
              </label>
            </div>
            <div className="row">
              <label>
                Е-пошта *
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={user?.email ?? ""}
                />
              </label>
              <label>
                Префериран контакт
                <select name="consultationFormat">
                  <option value="Phone">Телефонски повик</option>
                  <option value="Online">Онлајн состанок</option>
                  <option value="InPerson">Средба во живо</option>
                </select>
              </label>
            </div>
            <h3>Организација</h3>
            <div className="row">
              <label>
                Назив на фирма / организација *
                <input name="organization" required />
              </label>
              <label>
                Тип
                <select name="organizationType">
                  <option value="SME">Мало или средно претпријатие</option>
                  <option value="Company">Компанија</option>
                  <option value="PublicInstitution">Јавна институција</option>
                  <option value="NGO">Здружение / НВО</option>
                </select>
              </label>
            </div>
            {requestType === "Partnership" && (
              <>
                <div className="row">
                  <label>
                    Даночен број *
                    <input name="taxNumber" required inputMode="numeric" />
                  </label>
                  <label>
                    Матичен број *
                    <input
                      name="registrationNumber"
                      required
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <label>
                  Адреса на седиште *<input name="address" required />
                </label>
              </>
            )}
            <div className="row">
              <label>
                Дејност / сектор
                <input name="sector" />
              </label>
              <label>
                Број на вработени
                <input name="employeeCount" type="number" min="1" />
              </label>
            </div>
            <div className="row">
              <label>
                Општина
                <input name="municipality" />
              </label>
              <label>
                Веб-страница
                <input name="website" type="url" placeholder="https://" />
              </label>
            </div>
            <h3>Вашите потреби</h3>
            <label>
              Кратко опишете го предизвикот или идејата *
              <textarea
                name="challenge"
                required
                rows={5}
                placeholder="Што сакате да подобрите или постигнете?"
              />
            </label>
            <div className="row">
              <label>
                Посакуван рок
                <select name="timeline">
                  <option value="AsSoonAsPossible">Што е можно поскоро</option>
                  <option value="1-3months">Во следните 1–3 месеци</option>
                  <option value="3-6months">Во следните 3–6 месеци</option>
                  <option value="Exploring">Само истражувам</option>
                </select>
              </label>
              <label>
                Ориентациски буџет
                <select name="budgetRange">
                  <option value="NotSet">Сè уште не е дефиниран</option>
                  <option value="Under1000">До 1.000 €</option>
                  <option value="1000-5000">1.000–5.000 €</option>
                  <option value="5000plus">Над 5.000 €</option>
                </select>
              </label>
            </div>
            <input type="hidden" name="digitalMaturityRating" value="3" />
            <label className="check">
              <input name="consent" type="checkbox" required />
              Се согласувам CRM System да ме контактира во врска со ова барање.
            </label>
            <label className="check">
              <input name="privacy" type="checkbox" required />
              Ја прочитав и ја прифаќам политиката за приватност.
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary submit-request" disabled={sending}>
              {sending ? "Се испраќа…" : "Испрати барање"}
              <span>→</span>
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
