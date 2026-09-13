import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading products" metrics={3} columns={6} rows={8} actions={2} />;
}
