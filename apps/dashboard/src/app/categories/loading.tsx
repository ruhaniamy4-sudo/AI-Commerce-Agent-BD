import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading categories" columns={4} rows={6} />;
}
