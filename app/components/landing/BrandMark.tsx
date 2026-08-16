import { cn } from "~/lib/utils";
import { versionedAsset } from "~/lib/build";

export function BrandMark({
    className,
    height = 22,
    invert = false,
}: {
    className?: string;
    height?: number;
    invert?: boolean;
}) {
    const src = versionedAsset(
        invert ? "/ai-diy-mark.png" : "/ai-diy-mark-white.png",
    );
    return (
        <img
            src={src}
            alt="ai.diy"
            height={height}
            className={cn("w-auto object-contain object-left", className)}
            style={{ height }}
        />
    );
}
