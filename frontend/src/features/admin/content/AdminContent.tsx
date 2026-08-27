import type { FormEvent } from "react";
import type { Language } from "../../../shared/types";
import type { ContentCollection } from "../../../pages/admin/adminModels";
import type { workspaceCopy } from "../../../content/workspaceCopy";
import {
  ContentForm,
  ContentInventory,
} from "../../../pages/admin/AdminSharedComponents";

type Resource = {
  data: ContentCollection | null;
  loading: boolean;
  error: string;
};

type Props = {
  t: ReturnType<typeof workspaceCopy>;
  language: Language;
  services: Resource;
  pages: Resource;
  onSave: (
    event: FormEvent<HTMLFormElement>,
    collection: "services" | "pages",
  ) => Promise<boolean>;
};

export function AdminContent({ t, language, services, pages, onSave }: Props) {
  return (
    <div className="workspace evidence-workspace content-workspace">
      <ContentForm
        title={t.service}
        onSubmit={(event) => onSave(event, "services")}
        language={language}
        category
      />
      <ContentForm
        title={t.publicPage}
        onSubmit={(event) => onSave(event, "pages")}
        language={language}
      />
      <ContentInventory
        title={
          language === "mk"
            ? "Зачувани услуги"
            : language === "sq"
              ? "Shërbimet e ruajtura"
              : "Saved services"
        }
        collection={services.data}
        loading={services.loading}
        error={services.error}
        language={language}
      />
      <ContentInventory
        title={
          language === "mk"
            ? "Зачувани јавни страници"
            : language === "sq"
              ? "Faqet publike të ruajtura"
              : "Saved public pages"
        }
        collection={pages.data}
        loading={pages.loading}
        error={pages.error}
        language={language}
      />
    </div>
  );
}
