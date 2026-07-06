import type { Metadata } from "next";
import { DocsPageClient } from "./DocsPageClient";

export const metadata: Metadata = {
  title: "OnePOS API Documentation",
  description: "OnePOS credit card deposit API integration guide",
};

export default function DocsPage() {
  return <DocsPageClient />;
}
