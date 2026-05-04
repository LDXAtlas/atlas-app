import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getMinistryDetailData } from "@/app/actions/ministry-hub";
import { MinistryDetailView } from "./_components/ministry-detail";

export default async function MinistryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const { data, error } = await getMinistryDetailData(slug);

  if (!data) {
    const reason = error ? `?error=${encodeURIComponent(error)}` : "";
    redirect(`/ministry-hub${reason}`);
  }

  return <MinistryDetailView detail={data} />;
}
