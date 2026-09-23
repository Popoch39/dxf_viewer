import { t } from "elysia";

export const CheckStatus = t.Union([t.Literal("ok"), t.Literal("down")]);

export type CheckStatus = typeof CheckStatus.static;

export const Health = t.Object({
  status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
  checks: t.Object({
    api: t.Literal("ok"),
    postgres: CheckStatus,
    redis: CheckStatus,
    storage: CheckStatus,
  }),
});

export type Health = typeof Health.static;
