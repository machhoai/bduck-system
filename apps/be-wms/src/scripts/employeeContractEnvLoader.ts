import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

export const loadEmployeeContractEnvironment = () => {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
  ];
  const envFile = candidates.find((candidate) => existsSync(candidate));
  if (!envFile) throw new Error("WORKSPACE_ENV_LOCAL_NOT_FOUND");
  loadEnvFile(envFile);
};
