"use client";

import OrgSettingsPage from "@/components/OrgSettingsPage";
import { useRouter } from "next/navigation";

export default function OrganizationsPage() {
  const router = useRouter();

  return (
    <OrgSettingsPage onBack={() => router.push("/dashboard")} />
  );
}
