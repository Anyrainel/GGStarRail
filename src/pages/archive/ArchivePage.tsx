import { Archive } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";
import type { MessageKey } from "@/i18n/messages.en";

interface ArchivePageProps {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}

export default function ArchivePage({
  titleKey,
  descriptionKey,
}: ArchivePageProps) {
  return (
    <>
      <PageHeader titleKey={titleKey} descriptionKey={descriptionKey} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <EmptyState messageKey="empty.archive" icon={Archive} />
        <StatusCard
          titleKey="archive.provenance.title"
          bodyKey="archive.provenance.body"
          statusKey="status.scaffolded"
          status="scaffolded"
          icon={Archive}
        />
      </div>
    </>
  );
}
