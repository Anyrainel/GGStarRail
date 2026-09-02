import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { messagesEn } from "@/i18n/messages.en";
import { messagesZhCn } from "@/i18n/messages.zh-CN";

function placeholders(message: string): string[] {
  return Array.from(message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g))
    .map((match) => match[1])
    .sort();
}

function LanguageProbe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <output>{locale}</output>
      <p>{t("route.characters.title")}</p>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        switch
      </button>
    </div>
  );
}

describe("typed bilingual catalog", () => {
  it("keeps exact key, non-empty value, and placeholder parity", () => {
    expect(Object.keys(messagesZhCn).sort()).toEqual(
      Object.keys(messagesEn).sort()
    );

    for (const key of Object.keys(messagesEn) as Array<
      keyof typeof messagesEn
    >) {
      expect(messagesEn[key].trim()).not.toBe("");
      expect(messagesZhCn[key].trim()).not.toBe("");
      expect(placeholders(messagesZhCn[key])).toEqual(
        placeholders(messagesEn[key])
      );
    }
  });

  it("persists zh-CN and synchronizes the document language", () => {
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(screen.getByText("角色")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(localStorage.getItem("ggstarrail:locale:v1")).toBe("zh-CN");
  });

  it("uses only valid literal calls and no template-generated keys", () => {
    const sourceRoot = path.resolve("src");
    const files = fs
      .readdirSync(sourceRoot, { recursive: true })
      .map(String)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !file.includes("messages.en"))
      .filter((file) => !file.includes("messages.zh-CN"));
    const validKeys = new Set(Object.keys(messagesEn));
    const invalid: string[] = [];
    const generated: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(path.join(sourceRoot, file), "utf8");
      for (const match of source.matchAll(/\bt\(\s*(["'])([^"']+)\1/g)) {
        if (!validKeys.has(match[2])) invalid.push(`${file}:${match[2]}`);
      }
      if (/\bt\(\s*`/.test(source)) generated.push(file);
    }

    expect(invalid).toEqual([]);
    expect(generated).toEqual([]);
  });
});
