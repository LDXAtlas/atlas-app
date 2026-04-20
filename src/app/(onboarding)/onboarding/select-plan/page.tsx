import { PlanSelector } from "./plan-selector";

export default function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  return <PlanSelector searchParamsPromise={searchParams} />;
}
