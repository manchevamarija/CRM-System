import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import { dashboardCopy } from "../../content/dashboardCopy";
import type { Profile } from "../../shared/domain";
import { usePortalLanguage } from "../../shared/usePortalLanguage";

type Props = {
  profile: Profile | null;
  onChanged: () => void;
};

export function ProfilePanel({ profile, onChanged }: Props) {
  const language = usePortalLanguage();
  const t = dashboardCopy[language].client;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!profile) return <p>{t.profileLoading}</p>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/profile/", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          phone: data.get("phone"),
          preferredLanguage: data.get("preferredLanguage"),
        }),
      });
      setMessage(t.saved);
      setError("");
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.saveError);
    }
  };

  return (
    <form className="workspace workspace-form" onSubmit={submit}>
      <h2>{t.profileSettings}</h2>
      <label>
        {t.email}
        <input value={profile.email} disabled />
      </label>
      <div className="row">
        <label>
          {t.firstName}
          <input name="firstName" defaultValue={profile.firstName} required />
        </label>
        <label>
          {t.lastName}
          <input name="lastName" defaultValue={profile.lastName} required />
        </label>
      </div>
      <label>
        {t.phone}
        <input name="phone" defaultValue={profile.phoneNumber} />
      </label>
      <label>
        {t.language}
        <select
          name="preferredLanguage"
          defaultValue={profile.preferredLanguage}
        >
          <option value="mk">Македонски</option>
          <option value="en">English</option>
          <option value="sq">Shqip</option>
        </select>
      </label>
      {message && <p className="notice">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="primary">{t.save}</button>
    </form>
  );
}
