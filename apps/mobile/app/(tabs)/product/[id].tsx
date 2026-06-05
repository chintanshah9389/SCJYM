/**
 * Product Detail Page — Display full product information with images
 * File: apps/mobile/app/(tabs)/product/[id].tsx
 */
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  images?: string[];
  avgRating?: number;
  ratingCount?: number;
  stock?: number;
  ownerId?: string;
  ownerName?: string;
  status?: string;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const carouselRef = useRef<FlatList>(null);

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () =>
      api.get(`/products/${id}`).then((r) => r.data?.data),
    enabled: !!id,
  });

  const addToCartMut = useMutation({
    mutationFn: () =>
      api.post("/cart/items", {
        productId: id,
        quantity: parseInt(quantity) || 1,
      }),
    onSuccess: () => {
      Alert.alert("Success", "Added to cart");
      setQuantity(1);
    },
    onError: (e: any) => {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Could not add to cart");
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Product not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const images: string[] =
    product.images && product.images.length > 0
      ? product.images
      : ["https://via.placeholder.com/400x400?text=No+Image"];

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIdx(idx);
  };

  const goToImage = (idx: number) => {
    setActiveImageIdx(idx);
    carouselRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Image Carousel */}
        <View style={styles.gallerySection}>
          <FlatList
            ref={carouselRef}
            data={images}
            keyExtractor={(_, idx) => String(idx)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onCarouselScroll}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH - 32,
              offset: (SCREEN_WIDTH - 32) * index,
              index,
            })}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            )}
          />
          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, idx) => (
                <TouchableOpacity key={idx} onPress={() => goToImage(idx)}>
                  <View style={[styles.dot, activeImageIdx === idx && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {images.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.thumbnail, activeImageIdx === idx && styles.thumbnailActive]}
                  onPress={() => goToImage(idx)}
                >
                  <Image source={{ uri }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{product.title}</Text>

          {/* Rating & Category */}
          <View style={styles.metaRow}>
            <Text style={styles.category}>{product.category}</Text>
            {product.avgRating !== undefined && (
              <Text style={styles.rating}>
                ★ {product.avgRating?.toFixed(1) ?? "—"} ({product.ratingCount ?? 0} reviews)
              </Text>
            )}
          </View>

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.price}>₹{product.price}</Text>
            {product.stock !== undefined && (
              <Text style={[styles.stock, product.stock > 0 ? styles.inStock : styles.outOfStock]}>
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </Text>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {/* Seller Info */}
          {product.ownerName && (
            <View style={styles.sellerSection}>
              <Text style={styles.sellerLabel}>Sold by</Text>
              <Text style={styles.sellerName}>{product.ownerName}</Text>
            </View>
          )}
        </View>

        {/* Quantity & Add to Cart */}
        <View style={styles.actionSection}>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Quantity</Text>
            <View style={styles.quantityInput}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, parseInt(quantity) - 1).toString())}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyField}
                value={quantity}
                onChangeText={(v) => setQuantity(v || "1")}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((parseInt(quantity) + 1).toString())}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addCartBtn, addToCartMut.isPending && { opacity: 0.7 }]}
            onPress={() => addToCartMut.mutate()}
            disabled={addToCartMut.isPending || (product.stock !== undefined && product.stock <= 0)}
          >
            {addToCartMut.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addCartBtnText}>🛒 Add to Cart</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 16, color: "#1a56db", fontWeight: "600" },
  backBtn: { backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  backBtnText: { color: "#1a56db", fontWeight: "600", fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  errorText: { fontSize: 18, color: "#ef4444", fontWeight: "600" },

  /* Gallery */
  gallerySection: { paddingHorizontal: 16, marginBottom: 24 },
  mainImage: { width: SCREEN_WIDTH - 32, height: 320, borderRadius: 16, backgroundColor: "#e5e7eb" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#d1d5db" },
  dotActive: { backgroundColor: "#1a56db", width: 20, borderRadius: 4 },
  thumbnailRow: { paddingVertical: 12, gap: 8 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: "#e5e7eb", overflow: "hidden" },
  thumbnailActive: { borderColor: "#1a56db" },
  thumbnailImage: { width: "100%", height: "100%" },

  /* Info */
  infoSection: { paddingHorizontal: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  category: { backgroundColor: "#eff6ff", color: "#1a56db", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: "600" },
  rating: { fontSize: 13, color: "#6b7280" },
  priceSection: { marginBottom: 16, gap: 6 },
  price: { fontSize: 26, fontWeight: "700", color: "#1a56db" },
  stock: { fontSize: 13, fontWeight: "600" },
  inStock: { color: "#059669" },
  outOfStock: { color: "#dc2626" },
  descSection: { marginBottom: 20 },
  descTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 6 },
  description: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  sellerSection: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, marginBottom: 16 },
  sellerLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "600", marginBottom: 2 },
  sellerName: { fontSize: 15, fontWeight: "600", color: "#111827" },

  /* Actions */
  actionSection: { paddingHorizontal: 16, gap: 12 },
  quantityRow: { gap: 12 },
  quantityLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  quantityInput: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  qtyBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 18, fontWeight: "700", color: "#1a56db" },
  qtyField: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: "#111827" },
  addCartBtn: { backgroundColor: "#1a56db", borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  addCartBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
