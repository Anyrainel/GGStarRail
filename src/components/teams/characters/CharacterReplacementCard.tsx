import { Users } from "lucide-react";
import { useState } from "react";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { CompactSelect, ControlField, ControlsRow } from "../team/Controls";
import { OptionButton, OptionButtonRow } from "../team/OptionButton";
import { RunButton } from "../team/RunButton";
import { TeamSectionCard } from "../team/TeamSectionCard";

type ReplacementMode = "replace" | "unowned";
interface ReplacementSettings {
  pool: string;
  eidolon4: string;
  eidolon5: string;
  superimposition34: string;
  superimposition5: string;
}
const defaults = (): ReplacementSettings => ({
  pool: "owned-owned",
  eidolon4: "account",
  eidolon5: "account",
  superimposition34: "account",
  superimposition5: "account",
});

/** Settings only until the native combat service supports roster replacement. */
export function CharacterReplacementCard({ team }: { team: TeamPlan }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ReplacementMode>("replace");
  const [byMode, setByMode] = useState({
    replace: defaults(),
    unowned: defaults(),
  });
  const settings = byMode[mode];
  const update = (key: keyof ReplacementSettings, value: string) =>
    setByMode((current) => ({
      ...current,
      [mode]: { ...current[mode], [key]: value },
    }));
  const pools = [
    { value: "owned-owned", label: t("teamCharacters.pool.ownedOwned") },
    { value: "owned-any", label: t("teamCharacters.pool.ownedAny") },
    ...(mode === "replace"
      ? [{ value: "all", label: t("teamCharacters.pool.all") }]
      : []),
  ];
  const poolDisplay =
    settings.pool === "owned-owned"
      ? t("teamCharacters.display.ownedOwned")
      : settings.pool === "owned-any"
        ? t("teamCharacters.display.ownedAny")
        : t("teamCharacters.display.all");
  const ranks = (kind: "eidolon" | "superimposition") => [
    { value: "account", label: t("teamCharacters.account") },
    ...Array.from({ length: kind === "eidolon" ? 7 : 5 }, (_, index) => {
      const rank = kind === "eidolon" ? index : index + 1;
      return {
        value: String(rank),
        label: `${kind === "eidolon" ? "E" : "S"}${rank}`,
      };
    }),
  ];
  return (
    <TeamSectionCard
      icon={Users}
      title={t("teamCharacters.title")}
      bodyClassName="p-0 2xl:p-0"
      data-section="character-replacements"
    >
      <OptionButtonRow label={t("teamCharacters.title")}>
        <OptionButton
          selected={mode === "replace"}
          onSelect={() => setMode("replace")}
          title={t("teamCharacters.mode.replace")}
        />
        <OptionButton
          selected={mode === "unowned"}
          onSelect={() => setMode("unowned")}
          title={t("teamCharacters.mode.unowned")}
        />
      </OptionButtonRow>
      <div className="space-y-2 p-1 2xl:p-2" data-team={team.id}>
        <ControlsRow>
          <ControlField label={t("teamCharacters.pool")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={settings.pool}
                options={pools}
                display={poolDisplay}
                className="w-44 min-w-0 sm:w-auto sm:max-w-80"
                onValueChange={(value) => update("pool", value)}
              />
            )}
          </ControlField>
          <ControlField label={t("teamCharacters.eidolon4")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={settings.eidolon4}
                options={ranks("eidolon")}
                onValueChange={(value) => update("eidolon4", value)}
              />
            )}
          </ControlField>
          <ControlField label={t("teamCharacters.eidolon5")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={settings.eidolon5}
                options={ranks("eidolon")}
                onValueChange={(value) => update("eidolon5", value)}
              />
            )}
          </ControlField>
          <ControlField label={t("teamCharacters.superimposition34")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={settings.superimposition34}
                options={ranks("superimposition")}
                onValueChange={(value) => update("superimposition34", value)}
              />
            )}
          </ControlField>
          <ControlField label={t("teamCharacters.superimposition5")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={settings.superimposition5}
                options={ranks("superimposition")}
                onValueChange={(value) => update("superimposition5", value)}
              />
            )}
          </ControlField>
        </ControlsRow>
        <ControlsRow className="mb-1">
          <RunButton
            label={t("teamCharacters.unavailable")}
            running={false}
            disabled
            onRun={() => {}}
          />
        </ControlsRow>
      </div>
    </TeamSectionCard>
  );
}
