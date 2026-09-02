import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";

export default function TriagePage() {
  return (
    <>
      <PageHeader
        titleKey="route.triage.title"
        descriptionKey="route.triage.description"
      />
      <div className="max-w-2xl">
        <StatusCard
          titleKey="triage.engine.title"
          bodyKey="triage.engine.body"
          statusKey="status.scaffolded"
          status="scaffolded"
          icon={ShieldCheck}
        />
      </div>
    </>
  );
}
