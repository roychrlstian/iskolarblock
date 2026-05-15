import { IMRaDPageClient } from "@/components/imrad/imrad-page-client";

export const metadata = {
  title: "IMRaD - IskolarBlock",
  description:
    "IMRaD-style research report on IskolarBlock, a blockchain-enabled scholarship platform, detailing the introduction, methods, results, and discussion of its design, implementation, evaluation, and key findings.",
};

// Static page with daily revalidation (FAQ content rarely changes)
export const revalidate = 86400; // 24 hours

export default function FAQPage() {
  return <IMRaDPageClient />;
}