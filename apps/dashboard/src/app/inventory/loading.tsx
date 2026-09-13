import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading inventory" metrics={3} columns={5} rows={8} />;
}
