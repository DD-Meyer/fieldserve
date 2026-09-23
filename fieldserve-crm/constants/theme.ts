export const colors = {
    // Light gray base for mobile application container
    background: "#F5F6FA",
    // Dark slate text ensuring high readability in sunlight (Contrast > 10:1)
    foreground: "#0F172A",
    // Pure white cards to cleanly pop out from the light gray background
    card: "#FFFFFF",
    // Soft neutral gray for background badges or inactive states
    muted: "#F1F5F9",
    // Medium-dark slate for secondary captions and secondary texts
    mutedForeground: "rgba(15, 23, 42, 0.6)",

    // Deep navy → lighter navy sweep used behind the home header/hero card,
    // matches the dashboard's dark blue banner (not a teal fade)
    headerGradient: ["#0A1247", "#152B6E", "#1E3A8A"] as const,
    // Kept for any component still referencing the old 3-stop gradient
    activeGradient: ["#F5F6FA", "#1E3A8A", "#F5F6FA"] as const,

    // Core Brand Identity
    primary: "#0A1247",
    // Bright royal-blue used for primary touch targets: avatar badge,
    // selected calendar date, active bottom-nav icon
    accent: "#2563EB",
    // Muted teal reserved for secondary indicators (booking dots, links)
    secondaryAccent: "#0D9488",

    // Layout & Borders
    border: "rgba(15, 23, 42, 0.08)",
    nav: "#FFFFFF",
    glass: "rgba(255, 255, 255, 0.15)", // for translucent stat chips on the navy header
    glassBorder: "rgba(255, 255, 255, 0.12)",

    // Status Tokens (Crucial for CRM Jobs)
    success: "#10B981", // matches the "+18% this week" green
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
        height: spacing[14], // 56px
        horizontalInset: spacing[6], // 24px
        radius: spacing[8], // 32px
        iconFrame: spacing[10], // 40px
        itemPaddingVertical: spacing[2], // 8px
    },
    header: {
        // Rounded-bottom navy hero seen behind "Good morning"
        radiusBottom: spacing[6], // 24px
        statChipRadius: spacing[3], // 12px
        statChipPadding: spacing[3], // 12px
    },
} as const;

export const typography = {
    fontFamily: {
        light: "PlusJakartaSans-Light",
        regular: "PlusJakartaSans-Regular",
        medium: "PlusJakartaSans-Medium",
        semiBold: "PlusJakartaSans-SemiBold",
        bold: "PlusJakartaSans-Bold",
        extraBold: "PlusJakartaSans-ExtraBold",
    },
    // Matches the hierarchy in the dashboard screenshot
    styles: {
        // "Good morning"
        greeting: {
            fontFamily: "PlusJakartaSans-Regular",
            fontSize: 14,
            lineHeight: 18,
            color: "rgba(255,255,255,0.7)",
        },
        // "Daryn Meyer"
        headerTitle: {
            fontFamily: "PlusJakartaSans-Bold",
            fontSize: 22,
            lineHeight: 28,
            color: "#FFFFFF",
        },
        // "Mon, 21 September 2026 · Global Detailers"
        headerSubtitle: {
            fontFamily: "PlusJakartaSans-Regular",
            fontSize: 12.5,
            lineHeight: 16,
            color: "rgba(255,255,255,0.55)",
        },
        // "5" / "$2.4k" / "1" stat numerals in header chips
        statValue: {
            fontFamily: "PlusJakartaSans-Bold",
            fontSize: 17,
            lineHeight: 20,
            color: "#FFFFFF",
        },
        // "Jobs Today" / "Today's Revenue" / "Pending"
        statLabel: {
            fontFamily: "PlusJakartaSans-Medium",
            fontSize: 11,
            lineHeight: 14,
            color: "rgba(255,255,255,0.6)",
        },
        // "Weekly Revenue" / "Booking Calendar" section titles
        sectionTitle: {
            fontFamily: "PlusJakartaSans-SemiBold",
            fontSize: 15.5,
            lineHeight: 20,
            color: "#0F172A",
        },
        // "Mon – Sun" / "Sep 2026" captions
        caption: {
            fontFamily: "PlusJakartaSans-Regular",
            fontSize: 12.5,
            lineHeight: 16,
            color: "rgba(15,23,42,0.5)",
        },
        // "$4,330"
        metricValue: {
            fontFamily: "PlusJakartaSans-ExtraBold",
            fontSize: 20,
            lineHeight: 24,
            color: "#2563EB",
        },
        // "+18% this week"
        metricDelta: {
            fontFamily: "PlusJakartaSans-SemiBold",
            fontSize: 11.5,
            lineHeight: 14,
            color: "#10B981",
        },
        // "View schedule" link
        linkLabel: {
            fontFamily: "PlusJakartaSans-SemiBold",
            fontSize: 13,
            lineHeight: 16,
            color: "#0D9488",
        },
        // Calendar day numbers, weekday letters (S M T W T F S)
        calendarDay: {
            fontFamily: "PlusJakartaSans-Medium",
            fontSize: 13,
            lineHeight: 16,
            color: "#0F172A",
        },
        calendarWeekday: {
            fontFamily: "PlusJakartaSans-Medium",
            fontSize: 11,
            lineHeight: 14,
            color: "rgba(15,23,42,0.4)",
        },
        // "TODAY" eyebrow above the agenda list
        eyebrow: {
            fontFamily: "PlusJakartaSans-Bold",
            fontSize: 10.5,
            lineHeight: 13,
            letterSpacing: 0.6,
            color: "#2563EB",
        },
        // "08:00" / "James Harrington" agenda rows
        body: {
            fontFamily: "PlusJakartaSans-Regular",
            fontSize: 13.5,
            lineHeight: 18,
            color: "#0F172A",
        },
        // Bottom nav labels ("Home", "Customers"...)
        navLabel: {
            fontFamily: "PlusJakartaSans-Medium",
            fontSize: 10.5,
            lineHeight: 13,
        },
    },
} as const;

export const theme = {
    colors,
    spacing,
    components,
    typography,
} as const;