"use client";

import { auth } from "@/lib/firebase";

async function getAuthorizationHeader(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return {};

  const token = await user.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const authHeader = await getAuthorizationHeader();
  Object.entries(authHeader).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status !== 401 || !auth.currentUser) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  const refreshedAuthHeader = await getAuthorizationHeader(true);
  Object.entries(refreshedAuthHeader).forEach(([key, value]) =>
    retryHeaders.set(key, value),
  );

  return fetch(input, {
    ...init,
    credentials: "include",
    headers: retryHeaders,
  });
}
