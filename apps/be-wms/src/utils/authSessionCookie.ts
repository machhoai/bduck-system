import type { CookieOptions } from "express";

export const buildAuthSessionCookieOptions = (
  expiresIn: number,
  nodeEnvironment: string | undefined,
): CookieOptions => ({
  maxAge: expiresIn,
  httpOnly: true,
  secure: nodeEnvironment === "production",
  sameSite: "strict",
});
