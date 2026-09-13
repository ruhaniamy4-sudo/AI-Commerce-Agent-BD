import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading orders" metrics={3} columns={6} rows={8} tabs={4} />;
}
