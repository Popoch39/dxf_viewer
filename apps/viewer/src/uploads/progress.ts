/** Bytes of a Fichier source sent at a given time, in milliseconds. */
export interface ProgressSample {
  at: number;
  loaded: number;
}

// The rate is measured over the last few seconds, so it follows the network.
const RATE_WINDOW_MS = 5000;

// Below this span, the rate is noise.
const MIN_RATE_SPAN_MS = 500;

/** The samples, with a new one, trimmed to the ones the rate is measured on. */
export function withSample(
  samples: readonly ProgressSample[],
  at: number,
  loaded: number,
): ProgressSample[] {
  return [...samples.filter((sample) => at - sample.at <= RATE_WINDOW_MS), { at, loaded }];
}

/** How much of the file is sent, from 0 to 100. */
export function percentSent(loaded: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((loaded / total) * 100));
}

/** Seconds left to send the file at the current rate, or `null` while it cannot be told. */
export function remainingSeconds(samples: readonly ProgressSample[], total: number): number | null {
  const first = samples.at(0);
  const last = samples.at(-1);

  if (first === undefined || last === undefined || last.at - first.at < MIN_RATE_SPAN_MS) {
    return null;
  }

  const bytesPerSecond = ((last.loaded - first.loaded) * 1000) / (last.at - first.at);

  if (bytesPerSecond <= 0) {
    return null;
  }

  return Math.max(0, total - last.loaded) / bytesPerSecond;
}

const UNITS = ["o", "Ko", "Mo", "Go"];

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** A size in bytes, for people: `1,5 Mo`. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${decimal.format(value)} ${UNITS[unit]}`;
}

/** A duration, rounded up to the second: `8 s`, `2 min 05 s`, `1 h 04 min`. */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${String(rest).padStart(2, "0")} s`;
  }

  return `${rest} s`;
}
