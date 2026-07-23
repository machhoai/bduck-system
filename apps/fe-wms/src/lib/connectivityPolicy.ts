export type RemoteFailureStatus = "offline" | "error";

/**
 * Browser connectivity and remote-service health are different signals.
 * Only label a failure as offline when the browser itself reports no network.
 */
export function classifyRemoteFailure(
  isBrowserOnline: boolean,
): RemoteFailureStatus {
  return isBrowserOnline ? "error" : "offline";
}
