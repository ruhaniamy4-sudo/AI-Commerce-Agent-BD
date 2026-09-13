import { CardsSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <CardsSkeleton label="Loading store builder" cards={3} />;
}
