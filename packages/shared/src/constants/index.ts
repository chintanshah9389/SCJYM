// ─────────────────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────────────────
export const UserRole = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─────────────────────────────────────────────────────────────────────────────
// USER STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const UserStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const ProductStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const CommentStatus = {
  VISIBLE: "VISIBLE",
  HIDDEN: "HIDDEN",
  DELETED: "DELETED",
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

// ─────────────────────────────────────────────────────────────────────────────
// MENU ITEM TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const MenuItemType = {
  SCREEN_ROUTE: "SCREEN_ROUTE",
  WEB_URL: "WEB_URL",
  YOUTUBE_URL: "YOUTUBE_URL",
  LIVE_URL: "LIVE_URL",
  CATEGORY: "CATEGORY",
} as const;
export type MenuItemType = (typeof MenuItemType)[keyof typeof MenuItemType];

// ─────────────────────────────────────────────────────────────────────────────
// REGION LEVELS
// ─────────────────────────────────────────────────────────────────────────────
export const RegionLevel = {
  CITY: "CITY",
  STATE: "STATE",
  PINCODE: "PINCODE",
} as const;
export type RegionLevel = (typeof RegionLevel)[keyof typeof RegionLevel];

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING EVENT TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const TrackEventType = {
  VIEW_PRODUCT: "VIEW_PRODUCT",
  ADD_TO_CART: "ADD_TO_CART",
  RATE: "RATE",
  COMMENT: "COMMENT",
  PURCHASE: "PURCHASE",
} as const;
export type TrackEventType = (typeof TrackEventType)[keyof typeof TrackEventType];

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationType = {
  GENERAL: "GENERAL",
  PRODUCT_APPROVED: "PRODUCT_APPROVED",
  PRODUCT_REJECTED: "PRODUCT_REJECTED",
  USER_APPROVED: "USER_APPROVED",
  USER_REJECTED: "USER_REJECTED",
  NEW_COMMENT: "NEW_COMMENT",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
