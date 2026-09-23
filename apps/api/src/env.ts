function required(name: string): string {
  const value = Bun.env[name];

  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name} (see apps/api/.env.example)`);
  }

  return value;
}

function port(name: string, fallback: number): number {
  const raw = Bun.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid environment variable ${name}: "${raw}" is not a port`);
  }

  return value;
}

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

function logLevel(name: string, fallback: LogLevel): LogLevel {
  const raw = Bun.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  if (!isLogLevel(raw)) {
    throw new Error(
      `Invalid environment variable ${name}: "${raw}" is not one of ${LOG_LEVELS.join(", ")}`,
    );
  }

  return raw;
}

export const env = {
  port: port("PORT", 3000),
  logLevel: logLevel("LOG_LEVEL", "info"),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  auth: {
    secret: required("BETTER_AUTH_SECRET"),
    url: required("BETTER_AUTH_URL"),
  },
  s3: {
    endpoint: required("S3_ENDPOINT"),
    bucket: required("S3_BUCKET"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    region: Bun.env.S3_REGION ?? "us-east-1",
  },
} as const;
