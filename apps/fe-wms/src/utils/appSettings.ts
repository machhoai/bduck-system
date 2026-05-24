export type AppLanguage = "vi" | "zh";

export type AppSettingKey = string;

export type AppSettingValue =
  | AppLanguage
  | boolean
  | number
  | string
  | null
  | AppSettingValue[]
  | { [key: string]: AppSettingValue };

export interface AppSetting<TValue extends AppSettingValue = AppSettingValue> {
  key: AppSettingKey;
  value: TValue;
  updatedAt: string;
}

export const DEFAULT_LANGUAGE: AppLanguage = "vi";
export const APP_SETTINGS_STORAGE_KEY = "wms-settings";
const LEGACY_LANGUAGE_STORAGE_KEY = "wms-lang";

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "vi" || value === "zh";
}

function isAppSettingValue(value: unknown): value is AppSettingValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isAppSettingValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isAppSettingValue);
  }

  return false;
}

export function readAppSettings(): AppSetting[] {
  if (!isBrowser()) return [];

  try {
    const rawSettings = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return [];

    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!Array.isArray(parsedSettings)) return [];

    return parsedSettings.flatMap((setting): AppSetting[] => {
      if (!setting || typeof setting !== "object") return [];

      const candidate = setting as Partial<AppSetting>;
      if (
        typeof candidate.key !== "string" ||
        !isAppSettingValue(candidate.value)
      ) {
        return [];
      }

      return [
        {
          key: candidate.key,
          value: candidate.value,
          updatedAt:
            typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
        },
      ];
    });
  } catch (error) {
    console.error("Failed to read app settings from localStorage", error);
    return [];
  }
}

export function writeAppSettings(settings: AppSetting[]) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch (error) {
    console.error("Failed to write app settings to localStorage", error);
  }
}

export function getStoredLanguage(): AppLanguage {
  const settings = readAppSettings();
  const languageSetting = settings.find(
    (setting) => setting.key === "language",
  );

  if (isAppLanguage(languageSetting?.value)) {
    return languageSetting.value;
  }

  if (!isBrowser()) return DEFAULT_LANGUAGE;

  const legacyLanguage = window.localStorage.getItem(
    LEGACY_LANGUAGE_STORAGE_KEY,
  );
  return isAppLanguage(legacyLanguage) ? legacyLanguage : DEFAULT_LANGUAGE;
}

export function saveLanguageSetting(language: AppLanguage) {
  const currentSettings = readAppSettings();
  const nextSetting: AppSetting<AppLanguage> = {
    key: "language",
    value: language,
    updatedAt: new Date().toISOString(),
  };

  const settingIndex = currentSettings.findIndex(
    (setting) => setting.key === "language",
  );
  const nextSettings =
    settingIndex >= 0
      ? currentSettings.map((setting, index) =>
          index === settingIndex ? nextSetting : setting,
        )
      : [...currentSettings, nextSetting];

  writeAppSettings(nextSettings);
}
