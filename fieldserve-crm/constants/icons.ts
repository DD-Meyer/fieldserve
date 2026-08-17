import bookings from "@/assets/icons/bookings.png";
import customers from "@/assets/icons/customers.png";
import home1 from "@/assets/icons/home1.png";
import map from "@/assets/icons/map.png";
import menu from "@/assets/icons/menu.png";
import schedule from "@/assets/icons/schedule.png";

export const icons = {
    home1,
    customers,
    bookings,
    schedule,
    map,
    menu,
} as const;

export type IconKey = keyof typeof icons;