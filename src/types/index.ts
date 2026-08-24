export * from "./database";

export type AuditAction =
  | "AUTH_LOGIN"
  | "AUTH_SIGNUP"
  | "AUTH_LOGOUT"
  | "POST_CREATE"
  | "POST_UPDATE"
  | "POST_DELETE"
  | "POST_RESTORE"
  | "COMMENT_CREATE"
  | "COMMENT_DELETE"
  | "CHAT_ROOM_CREATE"
  | "CHAT_ROOM_LEAVE"
  | "PROFILE_UPDATE";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
