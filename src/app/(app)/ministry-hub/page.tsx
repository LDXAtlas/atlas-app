import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getMinistryOverviewData } from "@/app/actions/ministry-hub";
import { MinistryOverviewView } from "./_components/ministry-overview";

export default async function MinistryHubPage() {
  await connection();
  const overview = await getMinistryOverviewData();

  // Members and volunteers don't have access to Ministry Hub
  if (overview.role === "member" || overview.role === "volunteer") {
    redirect("/dashboard");
  }

  return <MinistryOverviewView overview={overview} />;
}
