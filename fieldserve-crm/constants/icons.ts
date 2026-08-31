import bookings from "@/assets/icons/bookings.png";
import customers from "@/assets/icons/customers.png";
import home1 from "@/assets/icons/home1.png";
import map from "@/assets/icons/map.png";
import menu from "@/assets/icons/hamburger.png";
import schedule from "@/assets/icons/schedule.png";
import back from "@/assets/icons/back.png";
import google from "@/assets/icons/google-color.png";
import logo from "@/assets/icons/logo-no-bg/fieldserve-logo-square-wbg.png";

export const icons = {
    home1,
    customers,
    bookings,
    schedule,
    map,
    menu,
    back,
    google,
    logo,
} as const;

export type IconKey = keyof typeof icons;