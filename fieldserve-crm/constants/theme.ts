export const colors = {
    background: "#F9FAFB",
    foreground: "#111827",
    card: "#FFFFFF",
    muted: "#ECFDF5",
    mutedForeground: "rgba(17, 24, 39, 0.65)",
    primary: "#111827",
    accent: "#14B8A6",
    secondaryAccent: "#2DD4BF",
    border: "rgba(17, 24, 39, 0.08)",
    success: "#10B981",
    destructive: "#EF4444",
    nav: "#f9fafbe6",
} as const;

export const spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    18: 72,
    20: 80,
    24: 96,
    30: 120,
} as const;

export const components = {
    tabBar: {
        height: spacing[14],
        horizontalInset: spacing[6],
        radius: spacing[8],
        iconFrame: spacing[10],
        itemPaddingVertical: spacing[2],
    },
} as const;

export const theme = {
    colors,
    spacing,
    components,
} as const;