"use client";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
  MarketingVoucherCodeStatus,
  MarketingVoucherJob,
  MarketingVoucherJobItem,
  MarketingVoucherRewardType,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebase";
import {
  mapMarketingVoucherCampaignDocument,
  mapMarketingVoucherCodeDocument,
  mapMarketingVoucherJobDocument,
  mapMarketingVoucherJobItemDocument,
} from "@/lib/marketingVoucherFirestore";
import { useUserStore } from "@/stores/useUserStore";

interface RealtimeState<T> {
  records: T[];
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
}

const useVoucherQuery = <T>(
  enabled: boolean,
  realtimeQuery: Query<DocumentData>,
  mapper: (snapshot: DocumentSnapshot<DocumentData>) => T,
) => {
  const accessEpoch = useUserStore((state) => state.accessEpoch);
  const [state, setState] = useState<RealtimeState<T>>({
    records: [],
    isLoading: enabled,
    error: null,
    isFromCache: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        records: [],
        isLoading: false,
        error: null,
        isFromCache: false,
      });
      return;
    }
    let unsubscribeSnapshot: (() => void) | undefined;
    let disposed = false;
    setState((current) => ({ ...current, isLoading: true, error: null }));
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      if (!user) {
        setState({
          records: [],
          isLoading: false,
          error: new Error("MARKETING_VOUCHER_AUTH_REQUIRED"),
          isFromCache: false,
        });
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        realtimeQuery,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (disposed) return;
          setState({
            records: snapshot.docs.map(mapper),
            isLoading: false,
            error: null,
            isFromCache: snapshot.metadata.fromCache,
          });
        },
        (error) => {
          if (disposed) return;
          console.error("[marketingVoucherRealtime] listener error:", error);
          setState((current) => ({ ...current, isLoading: false, error }));
        },
      );
    });
    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [accessEpoch, enabled, mapper, realtimeQuery]);

  return state;
};

export const useMarketingVoucherCampaigns = (enabled: boolean) => {
  const realtimeQuery = useMemo(
    () =>
      query(
        collection(db, "marketing_voucher_campaigns"),
        where("is_deleted", "==", false),
        orderBy("updated_at", "desc"),
        limit(100),
      ),
    [],
  );
  return useVoucherQuery<MarketingVoucherCampaign>(
    enabled,
    realtimeQuery,
    mapMarketingVoucherCampaignDocument,
  );
};

export const useMarketingVoucherJobs = (enabled: boolean) => {
  const realtimeQuery = useMemo(
    () =>
      query(
        collection(db, "marketing_voucher_jobs"),
        where("is_deleted", "==", false),
        orderBy("created_at", "desc"),
        limit(100),
      ),
    [],
  );
  return useVoucherQuery<MarketingVoucherJob>(
    enabled,
    realtimeQuery,
    mapMarketingVoucherJobDocument,
  );
};

export const useMarketingVoucherJobItems = (
  enabled: boolean,
  jobId: string | null,
) => {
  const realtimeQuery = useMemo(
    () =>
      query(
        collection(db, "marketing_voucher_jobs", jobId ?? "__none__", "items"),
        orderBy("created_at", "asc"),
        limit(400),
      ),
    [jobId],
  );
  return useVoucherQuery<MarketingVoucherJobItem>(
    enabled && Boolean(jobId),
    realtimeQuery,
    mapMarketingVoucherJobItemDocument,
  );
};

export interface MarketingVoucherCodeFilters {
  campaignId: string;
  status: MarketingVoucherCodeStatus | "";
  rewardType: MarketingVoucherRewardType | "";
  code: string;
}

export const useMarketingVoucherCodes = (input: {
  enabled: boolean;
  filters: MarketingVoucherCodeFilters;
  cursor: string | null;
  pageSize?: number;
}) => {
  const accessEpoch = useUserStore((state) => state.accessEpoch);
  const pageSize = input.pageSize ?? 50;
  const [state, setState] = useState<RealtimeState<MarketingVoucherCode>>({
    records: [],
    isLoading: input.enabled,
    error: null,
    isFromCache: false,
  });
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!input.enabled) {
      setState({
        records: [],
        isLoading: false,
        error: null,
        isFromCache: false,
      });
      setHasMore(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    setState((current) => ({ ...current, isLoading: true, error: null }));
    const subscribe = async () => {
      try {
        if (input.filters.code.trim()) {
          const reference = doc(
            db,
            "marketing_voucher_codes",
            input.filters.code.trim(),
          );
          unsubscribe = onSnapshot(
            reference,
            (snapshot) => {
              if (disposed) return;
              const code = snapshot.exists()
                ? mapMarketingVoucherCodeDocument(snapshot)
                : null;
              const matches =
                code &&
                !code.is_deleted &&
                (!input.filters.campaignId ||
                  code.campaign_id === input.filters.campaignId) &&
                (!input.filters.status ||
                  code.status === input.filters.status) &&
                (!input.filters.rewardType ||
                  code.reward_type === input.filters.rewardType);
              setState({
                records: matches && code ? [code] : [],
                isLoading: false,
                error: null,
                isFromCache: snapshot.metadata.fromCache,
              });
              setHasMore(false);
            },
            (error) => {
              console.error(
                "[marketingVoucherCodes] code listener error:",
                error,
              );
              if (!disposed) {
                setState((current) => ({
                  ...current,
                  isLoading: false,
                  error,
                }));
              }
            },
          );
          return;
        }
        const constraints: QueryConstraint[] = [
          where("is_deleted", "==", false),
        ];
        if (input.filters.campaignId) {
          constraints.push(
            where("campaign_id", "==", input.filters.campaignId),
          );
        }
        if (input.filters.status)
          constraints.push(where("status", "==", input.filters.status));
        if (input.filters.rewardType) {
          constraints.push(
            where("reward_type", "==", input.filters.rewardType),
          );
        }
        constraints.push(orderBy("created_at", "desc"));
        if (input.cursor) {
          const cursorSnapshot = await getDoc(
            doc(db, "marketing_voucher_codes", input.cursor),
          );
          if (cursorSnapshot.exists())
            constraints.push(startAfter(cursorSnapshot));
        }
        constraints.push(limit(pageSize + 1));
        unsubscribe = onSnapshot(
          query(collection(db, "marketing_voucher_codes"), ...constraints),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (disposed) return;
            const pageDocuments = snapshot.docs.slice(0, pageSize);
            setState({
              records: pageDocuments.map(mapMarketingVoucherCodeDocument),
              isLoading: false,
              error: null,
              isFromCache: snapshot.metadata.fromCache,
            });
            setHasMore(snapshot.docs.length > pageSize);
          },
          (error) => {
            console.error("[marketingVoucherCodes] listener error:", error);
            if (!disposed)
              setState((current) => ({ ...current, isLoading: false, error }));
          },
        );
      } catch (error) {
        console.error("[marketingVoucherCodes] setup error:", error);
        if (!disposed) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      }
    };
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) void subscribe();
    });
    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribe?.();
    };
  }, [accessEpoch, input.cursor, input.enabled, input.filters, pageSize]);

  return {
    ...state,
    nextCursor: hasMore ? (state.records.at(-1)?.id ?? null) : null,
  };
};
