import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setReferenceLocale } from "@/config/referenceLocale";
import { eidolonLevelBonuses } from "@/domain/combat/kit/skillLevels";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { setBetaEnabled } from "@/providers/reference/betaState";
import { loadGameMember } from "@/providers/reference/gameDataLoader";
import type {
  CharacterDefinition,
  RelicPieceDefinition,
} from "@/providers/reference/types";

const loadCharacters = () =>
  loadGameMember("characters") as Promise<{ value: CharacterDefinition[] }>;

function Catalog() {
  const { locale, setLocale } = useI18n();
  const resource = useCatalogResource(loadCharacters);
  const march = resource.data?.value.find((entry) => entry.id === "1001");
  return (
    <>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        Chinese
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
      <p>
        {resource.loading
          ? "Pending"
          : resource.error
            ? "Failed"
            : march?.name[locale]?.value}
      </p>
    </>
  );
}

describe("language-specific game catalogs", () => {
  it("preserves scanner relic identity equivalence in either language", async () => {
    const [en, zh] = (await Promise.all([
      loadGameMember("relic_pieces", "en"),
      loadGameMember("relic_pieces", "zh-CN"),
    ])) as { value: RelicPieceDefinition[] }[];
    const chinese = new Map(zh.value.map((piece) => [piece.id, piece]));
    for (const piece of en.value) {
      const peers = en.value.filter(
        (other) =>
          other.set_id === piece.set_id &&
          other.slot === piece.slot &&
          other.rarity === piece.rarity &&
          other.icon_path === piece.icon_path
      );
      for (const other of peers) {
        expect(
          chinese.get(piece.id)?.name["zh-CN"]?.value ===
            chinese.get(other.id)?.name["zh-CN"]?.value,
          `${piece.id}/${other.id}`
        ).toBe(piece.name.en?.value === other.name.en?.value);
      }
    }
  });
  it("fetches only the selected language and reuses stats when switching and returning", async () => {
    vi.resetModules();
    const { loadGameMember: load } = await import(
      "@/providers/reference/gameDataLoader"
    );
    const en = (await load("characters", "en")) as {
      value: CharacterDefinition[];
    };
    expect(en.value[0].name["zh-CN"]).toBeUndefined();
    expect(
      vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    ).toHaveLength(2);
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => /_zh\./.test(String(url)))
    ).toBe(false);
    const zh = (await load("characters", "zh-CN")) as {
      value: CharacterDefinition[];
    };
    expect(zh.value[0].name.en).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
    expect(await load("characters", "en")).toBe(en);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
  });

  it("reloads mounted consumers when the language changes", async () => {
    render(
      <I18nProvider>
        <Catalog />
      </I18nProvider>
    );
    await screen.findByText("March 7th");
    fireEvent.click(screen.getByText("Chinese"));
    await screen.findByText("三月七");
    fireEvent.click(screen.getByText("English"));
    await screen.findByText("March 7th");
  });

  it("does not let an old request replace the newly selected language", async () => {
    // A separate member avoids the cached catalogs above.
    let finish!: (value: string) => void;
    const en = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const loader = vi.fn(() => getLocaleValue());
    function getLocaleValue() {
      return language === "en" ? en : Promise.resolve("中文结果");
    }
    let language = "en";
    function Probe() {
      const { locale, setLocale } = useI18n();
      language = locale;
      const data = useCatalogResource(loader);
      return (
        <>
          <button type="button" onClick={() => setLocale("zh-CN")}>
            Switch
          </button>
          <p>{data.data}</p>
        </>
      );
    }
    setReferenceLocale("en");
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(loader).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Switch"));
    await screen.findByText("中文结果");
    await act(async () => finish("Old English result"));
    expect(screen.queryByText("Old English result")).not.toBeInTheDocument();
    expect(screen.getByText("中文结果")).toBeInTheDocument();
  });

  it("keeps every character's Eidolon skill levels identical in either language", async () => {
    setBetaEnabled(true);
    const [en, zh] = (await Promise.all([
      loadGameMember("characters", "en"),
      loadGameMember("characters", "zh-CN"),
    ])) as { value: CharacterDefinition[] }[];
    const english = en.value.flatMap((character) => [
      character,
      ...character.enhancements,
    ]);
    const chinese = zh.value.flatMap((character) => [
      character,
      ...character.enhancements,
    ]);
    expect(chinese).toHaveLength(english.length);
    for (let index = 0; index < english.length; index++) {
      for (let eidolon = 0; eidolon <= 6; eidolon++) {
        expect(
          eidolonLevelBonuses(chinese[index], eidolon),
          `${index}/E${eidolon}`
        ).toEqual(eidolonLevelBonuses(english[index], eidolon));
      }
    }
  });
});
