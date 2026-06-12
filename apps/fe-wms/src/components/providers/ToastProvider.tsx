"use client";

import {
  GooeyToaster,
  gooeyToast,
  type GooeyPromiseData,
  type GooeyToastOptions,
} from "goey-toast";
import { getDetailedErrorDescription, getDetailedErrorMessage } from "@/utils/apiError";
import "goey-toast/styles.css";

const DEFAULT_ERROR_TITLE = "Loi thao tac";
const DEFAULT_ERROR_DESCRIPTION = "Vui long kiem tra lai du lieu va thu lai.";
const DEFAULT_TOAST_DURATION = 6000;
const DISMISS_ANIMATION_BUFFER = 1200;

let isPromiseToastPatched = false;
let isAutoDismissPatched = false;

type ToastMethod = (title: string, options?: GooeyToastOptions) => string | number;

function resolveToastDuration(options?: GooeyToastOptions) {
  return options?.timing?.displayDuration ?? options?.duration ?? DEFAULT_TOAST_DURATION;
}

function withDefaultTiming(options?: GooeyToastOptions): GooeyToastOptions {
  return {
    ...options,
    timing: {
      ...options?.timing,
      displayDuration: resolveToastDuration(options),
    },
  };
}

function scheduleFallbackDismiss(id: string | number, options?: GooeyToastOptions) {
  const duration = resolveToastDuration(options);

  if (!Number.isFinite(duration)) return;

  window.setTimeout(() => {
    gooeyToast.dismiss(id);
  }, duration + DISMISS_ANIMATION_BUFFER);
}

function patchToastMethod(method: ToastMethod) {
  return ((title, options) => {
    const patchedOptions = withDefaultTiming(options);
    const id = method(title, patchedOptions);

    scheduleFallbackDismiss(id, patchedOptions);

    return id;
  }) satisfies ToastMethod;
}

function patchAutoDismissToast() {
  if (isAutoDismissPatched) return;

  gooeyToast.success = patchToastMethod(gooeyToast.success.bind(gooeyToast));
  gooeyToast.error = patchToastMethod(gooeyToast.error.bind(gooeyToast));
  gooeyToast.warning = patchToastMethod(gooeyToast.warning.bind(gooeyToast));
  gooeyToast.info = patchToastMethod(gooeyToast.info.bind(gooeyToast));

  isAutoDismissPatched = true;
}

function resolveErrorDescription<T>(
  original: GooeyPromiseData<T>["description"],
  error: unknown,
) {
  const fallback =
    typeof original?.error === "function"
      ? original.error(error)
      : original?.error;

  return getDetailedErrorDescription(
    error,
    typeof fallback === "string" ? fallback : DEFAULT_ERROR_DESCRIPTION,
  );
}

function patchPromiseToast() {
  if (isPromiseToastPatched) return;

  const originalPromise = gooeyToast.promise.bind(gooeyToast);

  gooeyToast.promise = ((promise, data) => {
    const patchedData = {
      ...data,
      timing: {
        ...data.timing,
        displayDuration: data.timing?.displayDuration ?? DEFAULT_TOAST_DURATION,
      },
      error:
        typeof data.error === "function"
          ? data.error
          : (error: unknown) =>
              getDetailedErrorMessage(
                error,
                typeof data.error === "string" ? data.error : DEFAULT_ERROR_TITLE,
              ),
      description: {
        ...data.description,
        error: (error: unknown) => resolveErrorDescription(data.description, error),
      },
    };

    const id = originalPromise(promise, patchedData);
    const duration = patchedData.timing.displayDuration;

    if (Number.isFinite(duration)) {
      const dismiss = () => {
        window.setTimeout(() => {
          gooeyToast.dismiss(id);
        }, duration + DISMISS_ANIMATION_BUFFER);
      };

      promise.then(dismiss, dismiss);
    }

    return id;
  }) as typeof gooeyToast.promise;

  isPromiseToastPatched = true;
}

export default function ToastProvider() {
  patchAutoDismissToast();
  patchPromiseToast();

  return (
    <GooeyToaster
      position="top-right"
      duration={DEFAULT_TOAST_DURATION}
      showProgress
    />
  );
}
