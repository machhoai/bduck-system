"use client";

import { gooeyToast } from "goey-toast";
import { useCallback, useState } from "react";

interface MutationMessages {
  loading: string;
  success: string;
  error: string;
  successDescription: string;
  errorDescription: string;
  retry: string;
}

interface MutationOptions<T> {
  key: string;
  task: () => Promise<T>;
  messages: MutationMessages;
  onSuccess?: (value: T) => void;
}

export const useMarketingVoucherMutation = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const runMutation = useCallback(
    async <T>(options: MutationOptions<T>): Promise<T | null> => {
      if (pendingKey) return null;
      setPendingKey(options.key);
      try {
        const operation = options.task();
        void gooeyToast.promise(operation, {
          loading: options.messages.loading,
          success: options.messages.success,
          error: (error: unknown) =>
            error instanceof Error ? error.message : options.messages.error,
          description: {
            success: options.messages.successDescription,
            error: options.messages.errorDescription,
          },
          action: {
            error: {
              label: options.messages.retry,
              onClick: () => void runMutation(options),
            },
          },
        });
        const value = await operation;
        options.onSuccess?.(value);
        return value;
      } catch (error) {
        console.error(`[marketingVoucherMutation:${options.key}]`, error);
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [pendingKey],
  );

  return { pendingKey, isPending: pendingKey !== null, runMutation };
};
