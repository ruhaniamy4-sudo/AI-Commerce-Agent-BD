import { CardsSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
    return <CardsSkeleton label="Loading availability" cards={2} />;
}
