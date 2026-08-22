import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
    { title: "Featured on Buildlist | ai.diy" },
    {
        name: "description",
        content: "ai.diy is featured on Buildlist.",
    },
];

export default function BuildlistPage() {
    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6">
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
        </main>
    );
}
