import type { LoaderFunctionArgs } from "react-router";
import { completeGrokBuildLogin } from "~/lib/server/grok-build-auth";

export function loader({ request }: LoaderFunctionArgs) {
    return completeGrokBuildLogin(request);
}
