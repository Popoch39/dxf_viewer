import { describe, expect, it } from "vitest";

import { authSearchSchema } from "./schemas";

describe("authSearchSchema", () => {
  it("keeps a path of the viewer", () => {
    expect(authSearchSchema.parse({ redirect: "/drawings/42?tab=layers" })).toEqual({
      redirect: "/drawings/42?tab=layers",
    });
  });

  it("drops a redirect to another origin", () => {
    expect(authSearchSchema.parse({ redirect: "https://evil.example" })).toEqual({});
    expect(authSearchSchema.parse({ redirect: "//evil.example" })).toEqual({});
    expect(authSearchSchema.parse({ redirect: "/\\evil.example" })).toEqual({});
  });

  it("accepts no redirect at all", () => {
    expect(authSearchSchema.parse({})).toEqual({});
  });
});
