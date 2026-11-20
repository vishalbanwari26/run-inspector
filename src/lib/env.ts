// Loads .env when there is one. In a container the variables come from the
// real environment and there is no file, which is fine.
export function loadEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file
  }
}
