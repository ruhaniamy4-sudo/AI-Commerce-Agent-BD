import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading meetings" columns={5} rows={6} />;
}
