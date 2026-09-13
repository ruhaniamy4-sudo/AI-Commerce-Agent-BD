import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading AI usage" metrics={4} columns={5} rows={6} />;
}
