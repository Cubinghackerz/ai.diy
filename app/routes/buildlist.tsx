import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
    { title: "Featured directories | ai.diy" },
    {
        name: "description",
        content: "ai.diy is featured on Buildlist and LaunchNest.",
    },
];

export default function BuildlistPage() {
    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <a
                    href="https://buildlist.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    aria-label="Featured on Buildlist"
                >
                    <img
                        src="https://buildlist.io/badge-dark.svg"
                        alt="Featured on Buildlist"
                        style={{ height: 40, width: "auto" }}
                    />
                </a>
                <a
                    href="https://launchnest.io/p/ai-diy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    aria-label="ai.diy on LaunchNest"
                >
                    <img
                        src="https://launchnest.io/badge/ai-diy.svg?variant=listed"
                        alt="ai.diy on LaunchNest"
                        width={220}
                        height={56}
                    />
                </a>
            </div>
        </main>
    );
}
