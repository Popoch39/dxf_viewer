function required(name: string, value: string | undefined): string {
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name} (see apps/viewer/.env.example)`);
  }

  return value;
}

// Vite only inlines `import.meta.env.VITE_*` when read statically, hence one
// argument per variable instead of a lookup by name.
export const env = {
  apiUrl: required("VITE_API_URL", import.meta.env.VITE_API_URL),
} as const;
