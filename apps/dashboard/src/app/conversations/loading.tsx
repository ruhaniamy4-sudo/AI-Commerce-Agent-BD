import { WorkspaceSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <WorkspaceSkeleton label="Loading conversations" columns={7} rows={8} tabs={5} actions={0} />;
}
