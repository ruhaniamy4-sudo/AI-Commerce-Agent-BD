import { CardsSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <CardsSkeleton label="Loading settings" cards={3} />;
}
