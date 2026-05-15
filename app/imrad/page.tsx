import { IMRaDPageClient } from "@/components/imrad/imrad-page-client";

export const metadata = {
  title: "IMRaD - IskolarBlock",
  description:
    "IMRaD (Introduction, Methods, Results, and Discussion) is a common structure for scientific papers. This page provides an overview of the IMRaD format and its components.",
};

// Static page with daily revalidation (FAQ content rarely changes)
export const revalidate = 86400; // 24 hours

export default function FAQPage() {
  return <IMRaDPageClient />;
}