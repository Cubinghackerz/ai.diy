import type { MetaFunction } from "react-router";
import { LaunchFallback } from "~/components/launch/LaunchFallback";

export function loader() {
    throw new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
    });
}

export const meta: MetaFunction = () => [
    { title: "Page not found - ai.diy" },
    { name: "robots", content: "noindex, follow" },
];

export function ErrorBoundary() {
    return (
        <LaunchFallback
            eyebrow="404 / NOT FOUND"
            title="That route does not exist."
            description="The page may have moved, or the link may be out of date."
        />
    );
}

export default function NotFoundPage() {
    return <ErrorBoundary />;
}
