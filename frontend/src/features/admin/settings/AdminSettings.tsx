import type { FormEvent } from "react";
import type { Setting } from "../../../pages/admin/adminModels";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import type { Language } from "../../../shared/types";

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  settings: Setting[];
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function AdminSettings({ t, language, settings, onSave }: Props) {
  const retention = settings.find((item) => item.key === "DataRetentionDays");
  const notificationRoles = new Set(
    (
      settings.find((item) => item.key === "StaffNotificationRoles")?.value ||
      "Admin,HelpDeskAgent,Expert"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const currentYears = Math.max(
    1,
    Math.round(Number(retention?.value || 730) / 365),
  );
  const copy =
    language === "mk"
      ? {
          intro:
            "Управувајте со основните правила на системот на едноставен и безбеден начин.",
          title: "Период на чување податоци",
          description:
            "Одберете колку долго да се чуваат оперативните известувања и привремените записи.",
          note: "По истекот, старите привремени податоци автоматски се отстрануваат.",
          period: "Период",
          year: "година",
          years: "години",
          data: "Податоци и приватност",
          automation: "Системски автоматизации",
          active: "Активно",
          cleanup: "Автоматско чистење",
          notices: "Системски известувања",
          notificationTitle: "Кој добива клиентски известувања",
          notificationDescription:
            "Одберете кои улоги од тимот ќе добиваат известувања за нови CRM барања, клиентски услуги, состаноци и промени.",
          admin: "Администратор",
          helpDesk: "Help-desk советник",
          expert: "Експерт",
        }
      : language === "sq"
        ? {
            intro:
              "Menaxhoni rregullat bazë të sistemit në mënyrë të thjeshtë dhe të sigurt.",
            title: "Periudha e ruajtjes së të dhënave",
            description:
              "Zgjidhni sa gjatë të ruhen njoftimet operative dhe të dhënat e përkohshme.",
            note: "Pas kësaj periudhe, të dhënat e vjetra të përkohshme hiqen automatikisht.",
            period: "Periudha",
            year: "vit",
            years: "vjet",
            data: "Të dhënat dhe privatësia",
            automation: "Automatizimet e sistemit",
            active: "Aktive",
            cleanup: "Pastrimi automatik",
            notices: "Njoftimet e sistemit",
            notificationTitle: "Kush merr njoftime nga klientët",
            notificationDescription:
              "Zgjidhni cilat role të ekipit marrin njoftime për kërkesa CRM, shërbime, takime dhe ndryshime.",
            admin: "Administrator",
            helpDesk: "Këshilltar help-desk",
            expert: "Ekspert",
          }
        : {
            intro:
              "Manage the system's essential rules in a simple and secure way.",
            title: "Data retention period",
            description:
              "Choose how long operational notifications and temporary records are kept.",
            note: "Older temporary data is removed automatically after this period.",
            period: "Period",
            year: "year",
            years: "years",
            data: "Data and privacy",
            automation: "System automations",
            active: "Active",
            cleanup: "Automatic cleanup",
            notices: "System notifications",
            notificationTitle: "Who receives client notifications",
            notificationDescription:
              "Choose which team roles receive notifications for new CRM requests, client services, meetings and changes.",
            admin: "Administrator",
            helpDesk: "Help-desk advisor",
            expert: "Expert",
          };

  return (
    <section className="settings-simple">
      <header>
        <span>CRM SYSTEM</span>
        <h2>{t.settings}</h2>
        <p>{copy.intro}</p>
      </header>
      <div className="settings-center-layout">
        <nav aria-label={t.settings}>
          <button className="active" type="button">
            <i>◫</i>
            <span>{copy.data}</span>
          </button>
          <div>
            <i>✓</i>
            <span>{copy.automation}</span>
            <small>{copy.active}</small>
          </div>
        </nav>
        <div className="settings-main-panel">
          <form className="retention-setting-card" onSubmit={onSave}>
            <input type="hidden" name="key" value="DataRetentionDays" />
            <input type="hidden" name="description" value={copy.description} />
            <div className="setting-icon" aria-hidden="true">
              ↻
            </div>
            <div className="setting-copy">
              <h3>{copy.title}</h3>
              <p>{copy.description}</p>
              <small>{copy.note}</small>
            </div>
            <div className="retention-controls">
              <label>
                <span>{copy.period}</span>
                <select name="value" defaultValue={String(currentYears * 365)}>
                  <option value="365">1 {copy.year}</option>
                  <option value="730">2 {copy.years}</option>
                  <option value="1095">3 {copy.years}</option>
                  <option value="1825">5 {copy.years}</option>
                </select>
              </label>
              <button className="settings-save">{t.save}</button>
            </div>
          </form>
          <section className="settings-automation-summary">
            <form className="notification-setting-card" onSubmit={onSave}>
              <input type="hidden" name="key" value="StaffNotificationRoles" />
              <input
                type="hidden"
                name="description"
                value={copy.notificationDescription}
              />
              <div>
                <b>{copy.notificationTitle}</b>
                <small>{copy.notificationDescription}</small>
              </div>
              <label>
                <input
                  type="checkbox"
                  name="roles"
                  value="Admin"
                  defaultChecked={notificationRoles.has("Admin")}
                />
                <span>{copy.admin}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="roles"
                  value="HelpDeskAgent"
                  defaultChecked={notificationRoles.has("HelpDeskAgent")}
                />
                <span>{copy.helpDesk}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="roles"
                  value="Expert"
                  defaultChecked={notificationRoles.has("Expert")}
                />
                <span>{copy.expert}</span>
              </label>
              <button className="settings-save">{t.save}</button>
            </form>
            <div>
              <span>✓</span>
              <p>
                <b>{copy.cleanup}</b>
                <small>{copy.note}</small>
              </p>
              <em>{copy.active}</em>
            </div>
            <div>
              <span>✓</span>
              <p>
                <b>{copy.notices}</b>
                <small>{copy.description}</small>
              </p>
              <em>{copy.active}</em>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
