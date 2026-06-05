/**
 * Mobile screen: Submit a new product for approval.
 * Allows picking up to 5 images, entering product details, and submitting.
 * File: apps/mobile/app/submit-product.tsx
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { brand, ui, shadows } from "@/lib/theme";

interface ImageAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export default function SubmitProductScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo library access to add images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim() || !description.trim() || !price.trim() || !category.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a valid price.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create product (DRAFT)
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { data: createRes } = await api.post("/products", {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category: category.trim(),
        tags: tagArr,
      });
      const productId: string = createRes.data._id;

      // Step 2: Upload images if any
      if (images.length > 0) {
        const formData = new FormData();
        for (const img of images) {
          formData.append("files", {
            uri: img.uri,
            name: img.fileName ?? "photo.jpg",
            type: img.mimeType ?? "image/jpeg",
          } as unknown as Blob);
        }
        await api.post(`/products/${productId}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // Step 3: Submit for approval
      await api.post(`/products/${productId}/submit`);

      Alert.alert(
        "Submitted!",
        "Your product has been submitted for approval. You will be notified once reviewed.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)"),
          },
        ]
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        "Submission failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Submit New Product</Text>
        <Text style={styles.subtitle}>
          Product will be reviewed by admins before becoming visible.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Product Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Handmade Ceramic Mug"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your product in detail..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Price (₹) *</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="e.g., 499"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Category *</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g., Handicrafts"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Tags (comma separated)</Text>
        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder="e.g., handmade, eco-friendly, gifting"
          placeholderTextColor="#9ca3af"
        />

        {/* Image Picker */}
        <Text style={styles.label}>Images (up to 5)</Text>
        <View style={styles.imageRow}>
          {images.map((img, idx) => (
            <View key={idx} style={styles.imageWrapper}>
              <Image source={{ uri: img.uri }} style={styles.thumbnail} />
              <Pressable style={styles.removeBtn} onPress={() => removeImage(idx)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </Pressable>
            </View>
          ))}
          {images.length < 5 && (
            <Pressable style={styles.addImageBtn} onPress={pickImages}>
              <Text style={styles.addImageText}>+ Add</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit for Approval</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ui.pageBg },
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: "800", color: ui.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: ui.textMuted, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: ui.text,
    ...shadows.soft,
  },
  textarea: { height: 100 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  imageWrapper: { position: "relative" },
  thumbnail: { width: 80, height: 80, borderRadius: 8 },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: ui.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.card,
  },
  addImageText: { fontSize: 13, color: ui.textMuted, fontWeight: "700" },
  submitBtn: {
    backgroundColor: brand.base,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
    ...shadows.soft,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#b91c1c", fontSize: 14 },
});
