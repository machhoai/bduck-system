import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";

const root = new URL("../", import.meta.url);
const enforce = process.argv.includes("--enforce");
const summaryOnly = process.argv.includes("--summary");
const inventory = JSON.parse(
  await readFile(
    new URL("../security/firestore-protection-inventory.json", import.meta.url),
    "utf8",
  ),
);

const protectionByCollection = new Map();
for (const [protectionClass, definition] of Object.entries(inventory.classes)) {
  for (const collectionName of definition.collections) {
    protectionByCollection.set(collectionName, protectionClass);
  }
}

async function walk(directoryUrl, extensions) {
  const files = [];
  for (const entry of await readdir(directoryUrl, { withFileTypes: true })) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directoryUrl,
    );
    if (entry.isDirectory()) {
      files.push(...(await walk(entryUrl, extensions)));
    } else if (extensions.has(extname(entry.name))) {
      files.push(entryUrl);
    }
  }
  return files;
}

function repositoryPath(fileUrl) {
  return relative(root.pathname, fileUrl.pathname)
    .replaceAll("\\", "/")
    .replace(/^\.\.\//u, "");
}

function lines(contents) {
  return contents.split(/\r?\n/u).map((text, index) => ({
    line: index + 1,
    text: text.trim(),
    raw: text,
  }));
}

function addFinding(finding) {
  const key = `${finding.kind}:${finding.file}:${finding.line}:${finding.collection ?? ""}`;
  if (findingKeys.has(key)) return;
  findingKeys.add(key);
  findings.push(finding);
}

function addObservation(observation) {
  const key = `${observation.kind}:${observation.file}:${observation.line}:${observation.collection ?? ""}`;
  if (observationKeys.has(key)) return;
  observationKeys.add(key);
  observations.push(observation);
}

const findings = [];
const findingKeys = new Set();
const observations = [];
const observationKeys = new Set();

const rulesUrl = new URL("../firestore.rules", import.meta.url);
const rulesContents = await readFile(rulesUrl, "utf8");
let currentTopLevelCollection = null;
for (const entry of lines(rulesContents)) {
  const topLevelMatch = entry.raw.match(/^ {4}match \/([A-Za-z0-9_]+)\//u);
  if (topLevelMatch) currentTopLevelCollection = topLevelMatch[1];

  if (entry.text !== "allow read: if isAuthenticated();") continue;
  const protectionClass = protectionByCollection.get(currentTopLevelCollection);
  if (protectionClass === "global_authenticated_master_data") continue;

  addFinding({
    kind: "unsafe-authenticated-firestore-read",
    file: "firestore.rules",
    line: entry.line,
    text: entry.text,
    collection: currentTopLevelCollection,
    protectionClass: protectionClass ?? "unclassified",
  });
}

const backendFiles = await walk(
  new URL("../apps/be-wms/src/", import.meta.url),
  new Set([".ts"]),
);
for (const fileUrl of backendFiles) {
  const contents = await readFile(fileUrl, "utf8");
  const file = repositoryPath(fileUrl);
  const isRoute = file.includes("/api/routes/");
  const isTest = file.endsWith(".test.ts");
  const isRbacMiddleware = file.endsWith("/api/middlewares/rbacMiddleware.ts");
  for (const entry of lines(contents)) {
    if (/requireAnyScopedPermission\(/u.test(entry.text)) {
      const result =
        isRoute || isTest || isRbacMiddleware ? addObservation : addFinding;
      result({
        kind: "unbound-any-scope-guard",
        file,
        line: entry.line,
        text: entry.text,
      });
    }

    if (
      !isTest &&
      /requirePermission\(\s*["'`][^"'`]+["'`]\s*\)/u.test(entry.text)
    ) {
      addFinding({
        kind: "unbound-specific-scope-guard",
        file,
        line: entry.line,
        text: entry.text,
      });
    }
  }
}

const authMiddlewareUrl = new URL(
  "../apps/be-wms/src/api/middlewares/authMiddleware.ts",
  import.meta.url,
);
const authMiddlewareContents = await readFile(authMiddlewareUrl, "utf8");
if (!/user\.status/u.test(authMiddlewareContents)) {
  addFinding({
    kind: "active-user-status-not-enforced",
    file: repositoryPath(authMiddlewareUrl),
    line: 68,
    text: "Authentication checks is_deleted but does not enforce User.status.",
  });
}

const revenueRoutesUrl = new URL(
  "../apps/be-wms/src/api/routes/revenueSyncRoutes.ts",
  import.meta.url,
);
const revenueRoutesContents = await readFile(revenueRoutesUrl, "utf8");
if (
  revenueRoutesContents.includes("requireAuth") &&
  !revenueRoutesContents.includes("requirePermission") &&
  !revenueRoutesContents.includes("requireAnyScopedPermission")
) {
  addFinding({
    kind: "auth-only-sensitive-route",
    file: repositoryPath(revenueRoutesUrl),
    line: 1,
    text: "Revenue routes authenticate but do not enforce revenue facility permissions.",
  });
}

const apiKeyMiddlewareUrl = new URL(
  "../apps/be-wms/src/api/middlewares/apiKeyMiddleware.ts",
  import.meta.url,
);
const apiKeyMiddlewareContents = await readFile(apiKeyMiddlewareUrl, "utf8");
if (/dev[_-]?(key|secret)|development/i.test(apiKeyMiddlewareContents)) {
  addFinding({
    kind: "development-auth-bypass",
    file: repositoryPath(apiKeyMiddlewareUrl),
    line: 1,
    text: "Development API credential bypass must be environment-gated or removed.",
  });
}

const frontendFiles = await walk(
  new URL("../apps/fe-wms/src/", import.meta.url),
  new Set([".ts", ".tsx"]),
);
const sensitiveProtectionClasses = new Set([
  "facility_scoped",
  "global_admin_configuration",
  "user_private_or_participant",
]);

for (const fileUrl of frontendFiles) {
  const contents = await readFile(fileUrl, "utf8");
  if (!contents.includes("onSnapshot")) continue;

  const file = repositoryPath(fileUrl);
  const fileLines = lines(contents);
  for (const entry of fileLines) {
    const staticReferences = [
      ...entry.raw.matchAll(
        /(?:collection|doc)\(\s*db\s*,\s*["'`]([A-Za-z0-9_]+)["'`]/gu,
      ),
    ];
    for (const match of staticReferences) {
      const collectionName = match[1];
      const protectionClass = protectionByCollection.get(collectionName);
      if (!sensitiveProtectionClasses.has(protectionClass)) continue;
      addObservation({
        kind: "sensitive-realtime-listener-reference",
        file,
        line: entry.line,
        text: entry.text,
        collection: collectionName,
        protectionClass,
      });
    }

    if (
      /(?:collection|doc)\(\s*db\s*,\s*[A-Za-z_$][A-Za-z0-9_.$]*/u.test(
        entry.raw,
      ) &&
      !entry.raw.trimStart().startsWith("import ")
    ) {
      addObservation({
        kind: "dynamic-realtime-listener-reference",
        file,
        line: entry.line,
        text: entry.text,
      });
    }
  }

  if (
    contents.includes("accessibleWarehouseIds") &&
    contents.includes(".filter(")
  ) {
    const filterLine = fileLines.find((entry) =>
      entry.text.includes("accessibleWarehouseIds.includes"),
    );
    addFinding({
      kind: "client-side-access-filter",
      file,
      line: filterLine?.line ?? 1,
      text: filterLine?.text ?? "Client filters access after loading data.",
    });
  }
}

const firebaseClientUrl = new URL(
  "../apps/fe-wms/src/lib/firebase.ts",
  import.meta.url,
);
const firebaseClientContents = await readFile(firebaseClientUrl, "utf8");
if (firebaseClientContents.includes("persistentLocalCache")) {
  addFinding({
    kind: "shared-sensitive-persistent-cache",
    file: repositoryPath(firebaseClientUrl),
    line: 60,
    text: "Persistent Firestore cache needs revocation and account-isolation handling.",
  });
}

const authProviderUrl = new URL(
  "../apps/fe-wms/src/components/providers/AuthSessionProvider.tsx",
  import.meta.url,
);
const authProviderContents = await readFile(authProviderUrl, "utf8");
if (/1000 \* 60 \* 60 \* 12/u.test(authProviderContents)) {
  addFinding({
    kind: "delayed-access-revocation-refresh",
    file: repositoryPath(authProviderUrl),
    line: 16,
    text: "Access refresh interval is twelve hours without an access-version listener.",
  });
}

const counts = findings.reduce((summary, finding) => {
  summary[finding.kind] = (summary[finding.kind] ?? 0) + 1;
  return summary;
}, {});
const observationCounts = observations.reduce((summary, observation) => {
  summary[observation.kind] = (summary[observation.kind] ?? 0) + 1;
  return summary;
}, {});

console.log(
  JSON.stringify(
    {
      inventoryVersion: inventory.version,
      enforce,
      counts,
      observationCounts,
      ...(summaryOnly ? {} : { findings, observations }),
    },
    null,
    2,
  ),
);

if (enforce && findings.length > 0) {
  process.exitCode = 1;
}
