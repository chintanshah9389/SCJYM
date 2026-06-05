import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { brand } from "../lib/theme";

type BrandMarkProps = {
  size?: number;
  light?: boolean;
  style?: ViewStyle;
};

export default function BrandMark({ size = 88, light = false, style }: BrandMarkProps) {
  const shell = light
    ? (["rgba(255,255,255,0.28)", "rgba(255,255,255,0.1)"] as const)
    : (["#ffffff", "#eef2ff"] as const);
  const nFill = light
    ? (["#ffffff", "rgba(255,255,255,0.78)"] as const)
    : (["#8e1631", "#d4455a"] as const);
  const accent = light ? "rgba(236,72,153,0.92)" : brand.accent;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <LinearGradient
        style={[
          styles.shell,
          {
            width: size * 0.84,
            height: size * 0.84,
            borderRadius: size * 0.14,
          },
        ]}
        colors={shell}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        style={[
          styles.nLeft,
          {
            width: size * 0.16,
            height: size * 0.52,
            borderRadius: size * 0.05,
            left: size * 0.26,
            top: size * 0.2,
          },
        ]}
        colors={nFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <LinearGradient
        style={[
          styles.nRight,
          {
            width: size * 0.16,
            height: size * 0.52,
            borderRadius: size * 0.05,
            right: size * 0.26,
            top: size * 0.2,
          },
        ]}
        colors={nFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <LinearGradient
        style={[
          styles.nDiagonal,
          {
            width: size * 0.13,
            height: size * 0.5,
            borderRadius: size * 0.045,
            left: size * 0.435,
            top: size * 0.215,
          },
        ]}
        colors={nFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.fold, { width: size * 0.18, height: size * 0.18, borderRadius: size * 0.05, backgroundColor: accent, top: size * 0.13, right: size * 0.14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  shell: {
    transform: [{ rotate: "45deg" }],
  },
  nLeft: {
    position: "absolute",
  },
  nRight: {
    position: "absolute",
  },
  nDiagonal: {
    position: "absolute",
    transform: [{ rotate: "-30deg" }],
  },
  fold: {
    position: "absolute",
    transform: [{ rotate: "45deg" }],
  },
});
