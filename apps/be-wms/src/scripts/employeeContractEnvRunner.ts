import { loadEmployeeContractEnvironment } from "./employeeContractEnvLoader.js";

const readTask = () =>
  process.argv
    .find((argument) => argument.startsWith("--task="))
    ?.slice("--task=".length);

const main = async () => {
  loadEmployeeContractEnvironment();
  const task = readTask();
  if (task === "reconcile") {
    await import("./reconcileEmployeeContracts.js");
    return;
  }
  if (task === "migrate") {
    await import("./migrateEmployeeContracts.js");
    return;
  }
  throw new Error("TASK_MUST_BE_RECONCILE_OR_MIGRATE");
};

main().catch((error) => {
  console.error(
    "[employeeContractEnvRunner]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
