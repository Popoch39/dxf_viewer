import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration, percentSent, remainingSeconds, withSample } from "./progress";

describe("withSample", () => {
  it("keeps only the samples of the last 5 seconds", () => {
    const samples = withSample(
      [
        { at: 0, loaded: 0 },
        { at: 4000, loaded: 10 },
      ],
      6000,
      20,
    );

    expect(samples).toEqual([
      { at: 4000, loaded: 10 },
      { at: 6000, loaded: 20 },
    ]);
  });
});

describe("percentSent", () => {
  it("rounds to a whole percent, capped at 100", () => {
    expect(percentSent(1, 3)).toBe(33);
    expect(percentSent(5, 4)).toBe(100);
    expect(percentSent(0, 0)).toBe(0);
  });
});

describe("remainingSeconds", () => {
  it("divides what is left by the rate", () => {
    const samples = [
      { at: 0, loaded: 0 },
      { at: 2000, loaded: 200 },
    ];

    expect(remainingSeconds(samples, 1000)).toBe(8);
  });

  it("cannot tell before half a second of samples", () => {
    expect(remainingSeconds([{ at: 0, loaded: 0 }], 1000)).toBeNull();
    expect(
      remainingSeconds(
        [
          { at: 0, loaded: 0 },
          { at: 100, loaded: 50 },
        ],
        1000,
      ),
    ).toBeNull();
  });

  it("cannot tell while nothing moves", () => {
    const samples = [
      { at: 0, loaded: 100 },
      { at: 1000, loaded: 100 },
    ];

    expect(remainingSeconds(samples, 1000)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("picks the unit", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(1536)).toBe("1,5 Ko");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3 Mo");
  });
});

describe("formatDuration", () => {
  it("rounds up to the second", () => {
    expect(formatDuration(0.2)).toBe("1 s");
    expect(formatDuration(7.1)).toBe("8 s");
  });

  it("switches to minutes, then hours", () => {
    expect(formatDuration(125)).toBe("2 min 05 s");
    expect(formatDuration(3840)).toBe("1 h 04 min");
  });
});
