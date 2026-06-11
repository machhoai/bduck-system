"use client";

import { GooeyToaster, gooeyToast, type GooeyPromiseData } from "goey-toast";
import { getDetailedErrorDescription, getDetailedErrorMessage } from "@/utils/apiError";
import "goey-toast/styles.css";

const DEFAULT_ERROR_TITLE = "Loi thao tac";
const DEFAULT_ERROR_DESCRIPTION = "Vui long kiem tra lai du lieu va thu lai.";

let isPromiseToastPatched = false;

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

    return originalPromise(promise, patchedData);
  }) as typeof gooeyToast.promise;

  isPromiseToastPatched = true;
}

export default function ToastProvider() {
  patchPromiseToast();

  return <GooeyToaster position="top-right" />;
}
