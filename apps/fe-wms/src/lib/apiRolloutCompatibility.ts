export const isMissingApiRoute = (status: number) =>
  status === 404 || status === 405;

export const shouldBootstrapSessionWithFirebase = (status: number) =>
  status === 401 || isMissingApiRoute(status);
