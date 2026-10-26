/**
 * Fails closed: local sign-in only under `next dev`, none elsewhere until SSO lands.
 * Deliberately no env flag to enable local sign-in in production.
 */
export const LOCAL_SIGN_IN_ENABLED = process.env.NODE_ENV === "development";

export const SESSION_COOKIE = "tr_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
