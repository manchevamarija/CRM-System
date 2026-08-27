import type { Dispatch, SetStateAction } from "react";
import { NotificationsPopup } from "../../components/layout/NotificationsPopup";
import type { workspaceCopy } from "../../content/workspaceCopy";
import type { Language, Navigate } from "../../shared/types";
import type { MyNotification } from "./adminModels";
import type { Tab } from "./AdminDashboardPage";

type MenuItem = { key: Tab; label: string };
type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  userEmail?: string;
  tab: Tab;
  menu: MenuItem[];
  newTickets: number;
  notifications: MyNotification[];
  unreadNotifications: number;
  popupOpen: boolean;
  setPopupOpen: Dispatch<SetStateAction<boolean>>;
  onSelect: (tab: Tab) => void;
  onOpenNotification: (item: MyNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteNotification: (item: MyNotification) => Promise<void>;
  onNavigate: Navigate;
  onLogout: () => Promise<void>;
};

export function AdminSidebar(props: Props) {
  const {
    t,
    language,
    userEmail,
    tab,
    menu,
    newTickets,
    notifications,
    unreadNotifications,
    popupOpen,
    setPopupOpen,
    onSelect,
    onOpenNotification,
    onMarkAllRead,
    onDeleteNotification,
    onNavigate,
    onLogout,
  } = props;

  return (
    <aside>
      <div className="user">
        <span>DA</span>
        <div>
          <b>{userEmail ?? "CRM System Admin"}</b>
          <small>{t.administrator}</small>
        </div>
      </div>
      <button className="logout" onClick={onLogout}>
        {t.logout}
      </button>
      {menu.map((item) =>
        item.key === "myNotifications" ? (
          <div className="notifications-anchor" key={item.key}>
            <button
              className={popupOpen ? "sel" : ""}
              onClick={() => setPopupOpen((value) => !value)}
            >
              <span>
                {item.label}
                {unreadNotifications > 0 && (
                  <span className="menu-badge">{unreadNotifications}</span>
                )}
              </span>
              <span>›</span>
            </button>
            {popupOpen && (
              <NotificationsPopup
                items={notifications}
                language={language}
                onClose={() => setPopupOpen(false)}
                onOpenItem={onOpenNotification}
                onMarkAllRead={onMarkAllRead}
                onDelete={onDeleteNotification}
              />
            )}
          </div>
        ) : (
          <button
            className={tab === item.key ? "sel" : ""}
            key={item.key}
            onClick={() => onSelect(item.key)}
          >
            <span>
              {item.label}
              {item.key === "tickets" && newTickets > 0 && (
                <span className="menu-badge">{newTickets}</span>
              )}
            </span>
            <span>›</span>
          </button>
        ),
      )}
      <button onClick={() => onNavigate("staff")}>
        {t.workspace} <span>›</span>
      </button>
      <button onClick={() => onNavigate("dashboard")}>{t.clientPortal}</button>
    </aside>
  );
}
