import { z } from "zod";
import { AccountSnapshotSchema } from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import { starRailServerForUid } from "@/providers/accountNormalization";
import { normalizeEnkaHsrShowcase } from "@/providers/enka/schema";
import type { AccountImportCatalog } from "@/providers/importCatalog";
import type { AccountImportDraft } from "@/providers/types";

const IntegerLikeSchema = z.union([
  z.number().int(),
  z.string().regex(/^\d+$/).transform(Number),
]);

const MiHoMoSubAffixSchema = z
  .object({
    affixId: IntegerLikeSchema,
    cnt: z.number().int().nonnegative().optional().default(0),
    step: z.number().int().nonnegative().optional().default(0),
  })
  .passthrough();

const MiHoMoRelicSchema = z
  .object({
    tid: IntegerLikeSchema,
    type: z.number().int().min(1).max(6),
    level: z.number().int().min(0).max(15).optional().default(0),
    mainAffixId: IntegerLikeSchema,
    subAffixList: z.array(MiHoMoSubAffixSchema).max(4).default([]),
  })
  .passthrough();

const MiHoMoEquipmentSchema = z
  .object({
    tid: IntegerLikeSchema.optional(),
    rank: z.number().int().min(1).max(5).optional(),
    level: z.number().int().min(1).max(100).optional(),
    promotion: z.number().int().min(0).max(8).optional(),
  })
  .passthrough();

const MiHoMoAvatarSchema = z
  .object({
    avatarId: IntegerLikeSchema,
    rank: z.number().int().min(0).max(6).optional(),
    level: z.number().int().min(1).max(100).optional(),
    promotion: z.number().int().min(0).max(8).optional(),
    equipment: MiHoMoEquipmentSchema.nullish(),
    relicList: z.array(MiHoMoRelicSchema).default([]),
    skillTreeList: z
      .array(
        z
          .object({
            pointId: IntegerLikeSchema,
            level: z.number().int().nonnegative(),
          })
          .passthrough()
      )
      .default([]),
  })
  .passthrough();

export const MiHoMoRawResponseSchema = z
  .object({
    detailInfo: z
      .object({
        uid: IntegerLikeSchema,
        nickname: z.string().min(1).max(64).optional(),
        level: z.number().int().min(1).max(100).optional(),
        isDisplayAvatar: z.boolean().optional(),
        assistAvatarDetail: MiHoMoAvatarSchema.nullish(),
        assistAvatarList: z.array(MiHoMoAvatarSchema).default([]),
        avatarDetailList: z.array(MiHoMoAvatarSchema).default([]),
      })
      .passthrough()
      .nullish(),
    developmentInfo: z.unknown().optional(),
  })
  .passthrough();

export type MiHoMoRawResponse = z.infer<typeof MiHoMoRawResponseSchema>;

export const UID_WARNING_MIHOMO_FALLBACK_USED = "UID_MIHOMO_FALLBACK_USED";
export const UID_WARNING_MIHOMO_INCOMPLETE_CHARACTER =
  "UID_MIHOMO_INCOMPLETE_CHARACTER";
export const UID_WARNING_MIHOMO_INCOMPLETE_LIGHT_CONE =
  "UID_MIHOMO_INCOMPLETE_LIGHT_CONE";
export const UID_WARNING_MIHOMO_INCOMPLETE_AFFIX =
  "UID_MIHOMO_INCOMPLETE_AFFIX";

function warning(code: string, id: number | string): string {
  return `${code}:${id}`;
}

export function normalizeMiHoMoRawShowcase(
  input: unknown,
  catalog: AccountImportCatalog,
  now = new Date(),
  expectedUid?: string
): AccountImportDraft {
  assertNoSensitiveFields(input);
  const result = MiHoMoRawResponseSchema.safeParse(input);
  if (!result.success) throw new Error("UID_IMPORT_INVALID_RESPONSE");
  const parsed = result.data;
  const detailInfo = parsed.detailInfo;
  const uid = detailInfo ? String(detailInfo.uid) : expectedUid;
  if (
    uid === undefined ||
    starRailServerForUid(uid) === null ||
    (expectedUid !== undefined && uid !== expectedUid)
  ) {
    throw new Error("UID_IMPORT_IDENTITY_MISMATCH");
  }

  const adapterWarnings = new Set<string>([UID_WARNING_MIHOMO_FALLBACK_USED]);
  const avatarDetailList = [
    ...(detailInfo?.assistAvatarDetail ? [detailInfo.assistAvatarDetail] : []),
    ...(detailInfo?.assistAvatarList ?? []),
    ...(detailInfo?.avatarDetailList ?? []),
  ].flatMap((avatar) => {
    if (
      avatar.level === undefined ||
      avatar.promotion === undefined ||
      avatar.rank === undefined
    ) {
      adapterWarnings.add(
        warning(UID_WARNING_MIHOMO_INCOMPLETE_CHARACTER, avatar.avatarId)
      );
      return [];
    }
    let equipment: {
      tid: number;
      rank: number;
      level: number;
      promotion: number;
    } | null = null;
    if (avatar.equipment) {
      const candidate = avatar.equipment;
      if (
        candidate.tid === undefined ||
        candidate.rank === undefined ||
        candidate.level === undefined ||
        candidate.promotion === undefined
      ) {
        adapterWarnings.add(
          warning(UID_WARNING_MIHOMO_INCOMPLETE_LIGHT_CONE, avatar.avatarId)
        );
      } else {
        equipment = {
          tid: candidate.tid,
          rank: candidate.rank,
          level: candidate.level,
          promotion: candidate.promotion,
        };
      }
    }
    return [
      {
        avatarId: avatar.avatarId,
        level: avatar.level,
        promotion: avatar.promotion,
        rank: avatar.rank,
        skillTreeList: avatar.skillTreeList,
        equipment,
        relicList: avatar.relicList.map((relic) => ({
          ...relic,
          subAffixList: relic.subAffixList.flatMap((affix) => {
            if (affix.cnt > 0) return [affix];
            adapterWarnings.add(
              warning(
                UID_WARNING_MIHOMO_INCOMPLETE_AFFIX,
                `${avatar.avatarId}:${relic.tid}:${affix.affixId}`
              )
            );
            return [];
          }),
        })),
      },
    ];
  });

  const normalized = normalizeEnkaHsrShowcase(
    {
      detailInfo: {
        uid: Number(uid),
        nickname: detailInfo?.nickname,
        level: detailInfo?.level,
        isDisplayAvatar: detailInfo?.isDisplayAvatar,
        avatarDetailList,
      },
      ttl: 0,
      uid: Number(uid),
      region: starRailServerForUid(uid),
    },
    catalog,
    now,
    expectedUid
  );
  const warnings = [...new Set([...normalized.warnings, ...adapterWarnings])];
  const account = AccountSnapshotSchema.parse({
    ...normalized.account,
    source: {
      ...normalized.account.source,
      sourceVersion: "mihomo-hsr-raw-v1",
      warnings,
    },
  });
  return { account, warnings };
}
