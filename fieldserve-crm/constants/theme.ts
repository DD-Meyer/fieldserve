export const colors = {
    // Light gray base for mobile application container
    background: "#F8F9FA", 
    // Dark slate gray text ensuring high readability in sunlight (Contrast > 10:1)
    foreground: "#111827", 
    // Pure white cards to cleanly pop out from the light gray background
    card: "#FFFFFF", 
    // Soft neutral gray for background badges or inactive states (instead of green)
    muted: "#F1F5F9", 
    // Medium-dark slate for secondary captions and secondary texts
    mutedForeground: "rgba(17, 24, 39, 0.65)",
    
    activeGradient: ["#021f94", "#14b8a6", "#f1f1f1"] as const,
    
    // Core Brand Identity
    primary: "#021F94", 
    // High-visibility interactive teal touch targets
    accent: "#0D9488", 
    secondaryAccent: "#14B8A6", 
    
    // Layout & Borders
    border: "rgba(17, 24, 39, 0.08)", 
    nav: "#FFFFFF", 
    glass: "rgba(255, 255, 255, 0.8)", 
    glassBorder: "rgba(17, 24, 39, 0.08)", 
    
    // Status Tokens (Crucial for CRM Jobs)
    success: "#10B981", 
    destructive: "#EF4444", 
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
        height: spacing[14], // 56px (Excellent touch height targeting)
        horizontalInset: spacing[6], // 24px container float padding
        radius: spacing[8], // 32px pill/rounded aesthetic
        iconFrame: spacing[10], // 40px bounding box for icons
        itemPaddingVertical: spacing[2], // 8px touch margin
    },
} as const;

export const theme = {
    colors,
    spacing,
    components,
} as const;