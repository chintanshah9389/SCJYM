import {
  UserRole,
  UserStatus,
  ProductStatus,
  CommentStatus,
  MenuItemType,
  RegionLevel,
  TrackEventType,
  NotificationType,
} from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────────────────────────────────────
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  address: Address;
  role: UserRole;
  status: UserStatus;
  fcmToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobile: string;
  address: Address;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product
// ─────────────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  inventory: number;
  images: string[];              // Cloudinary URLs
  status: ProductStatus;
  ownerId: string;
  avgRating: number;
  ratingCount: number;
  bayesianRating: number;
  bestSellerScore: number;
  weeklySalesCount: number;
  viewsCount: number;
  addToCartCount: number;
  lastActivityAt?: string;
  ratingsLocked: boolean;
  commentsLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating
// ─────────────────────────────────────────────────────────────────────────────
export interface Rating {
  id: string;
  productId: string;
  userId: string;
  score: number;              // 1–5
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment
// ─────────────────────────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  productId: string;
  userId: string;
  userFullName: string;
  body: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────────────────────────────────────
export interface CartItem {
  productId: string;
  title: string;
  imageUrl?: string;
  price: number;
  quantity: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Item
// ─────────────────────────────────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  order: number;
  enabled: boolean;
  rolesVisible: UserRole[];
  type: MenuItemType;
  target: string;             // route name, URL, category id, etc.
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification
// ─────────────────────────────────────────────────────────────────────────────
export interface PushNotification {
  id: string;
  userId?: string;            // null = broadcast
  title: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  deepLink?: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rankings
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductRegionStats {
  id: string;
  productId: string;
  regionKey: string;
  weeklySalesCount: number;
  viewsCountRegion: number;
  addToCartCountRegion: number;
  lastActivityAt?: string;
  bestSellerScoreRegion: number;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  topCategories: Array<{ categoryId: string; score: number }>;
  topTags: Array<{ tag: string; score: number }>;
  recentlyViewedProductIds: string[];
  personalizationOptOut: boolean;
  updatedAt: string;
}

export interface RankingConfig {
  globalMeanRating: number;
  priorStrength: number;
  minRatingCountForEligibility: number;
  minAvgRatingForEligibility: number;
  weightSales: number;
  weightRating: number;
  weightRatingVolume: number;
  weightRecency: number;
  regionLevel: RegionLevel;
  minRegionProductCount: number;
  personalizationEnabled: boolean;
  affinityWeightBase: number;
  affinityWeightPersonal: number;
  affinityIncrementView: number;
  affinityIncrementAddToCart: number;
  affinityIncrementPurchase: number;
  affinityIncrementRate: number;
  decayFactor: number;
  explorationPercentage: number;
  categoryDiversityLimit: number;
  topN: number;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Track Event
// ─────────────────────────────────────────────────────────────────────────────
export interface TrackEvent {
  eventType: TrackEventType;
  productId: string;
  categoryId: string;
  ts?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Responses (envelope)
// ─────────────────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; issue: string }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
