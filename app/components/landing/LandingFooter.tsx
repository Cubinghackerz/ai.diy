import { Link } from "react-router";
import { BrandMark } from "./BrandMark";
import {
    CHANGELOG_URL,
    DOCS_URL,
    GITHUB_URL,
    SUPPORT_EMAIL,
    SUPPORT_MAILTO,
    TWITTER_URL,
} from "./constants";
import { SEO_GUIDES } from "~/lib/seo-pages";

const linkClass =
    "inline-flex h-8 items-center transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[13px] font-medium text-white">{title}</p>
            <ul className="mt-3 space-y-0.5 text-[13px] text-zinc-400">{children}</ul>
        </div>
    );
}

export function LandingFooter() {
    return (
        <footer className="border-t border-white/[0.08]">
            <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:justify-between">
                <div className="max-w-xs">
                    <BrandMark height={22} />
                    <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">
                        Open tools for useful thinking. MIT licensed.
                    </p>
                    <a
                        href={SUPPORT_MAILTO}
                        className={`${linkClass} mt-2 text-[13px] text-zinc-400`}
                    >
                        {SUPPORT_EMAIL}
                    </a>
                </div>
                <div className="grid grid-cols-2 gap-x-14 gap-y-10 sm:grid-cols-4">
                    <Column title="Product">
                        <li>
                            <Link to="/workspace" reloadDocument className={linkClass}>
                                Workspace
                            </Link>
                        </li>
                        <li>
                            <a href="#features" className={linkClass}>
                                Ownership
                            </a>
                        </li>
                        <li>
                            <a href="#capabilities" className={linkClass}>
                                Features
                            </a>
                        </li>
                        <li>
                            <a href="#deploy" className={linkClass}>
                                Deploy
                            </a>
                        </li>
                        <li>
                            <a href="#faq" className={linkClass}>
                                FAQ
                            </a>
                        </li>
                    </Column>
                    <Column title="Resources">
                        <li>
                            <a
                                href={DOCS_URL}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                            >
                                Docs
                            </a>
                        </li>
                        <li>
                            <a
                                href={CHANGELOG_URL}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                            >
                                Changelog
                            </a>
                        </li>
                        <li>
                            <a
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                            >
                                GitHub
                            </a>
                        </li>
                        <li>
                            <a
                                href={`${GITHUB_URL}/blob/main/LICENSE`}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                            >
                                MIT License
                            </a>
                        </li>
                        <li>
                            <a
                                href={TWITTER_URL}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                            >
                                X / @HeckingHacker
                            </a>
                        </li>
                    </Column>
                    <Column title="Guides">
                        {SEO_GUIDES.map((guide) => (
                            <li key={guide.slug}>
                                <Link to={guide.path} className={linkClass}>
                                    {guide.label}
                                </Link>
                            </li>
                        ))}
                    </Column>
                    <Column title="Legal">
                        <li>
                            <Link to="/privacy" className={linkClass}>
                                Privacy
                            </Link>
                        </li>
                        <li>
                            <Link to="/terms" className={linkClass}>
                                Terms
                            </Link>
                        </li>
                        <li>
                            <a href={SUPPORT_MAILTO} className={linkClass}>
                                Contact
                            </a>
                        </li>
                    </Column>
                </div>
            </div>
            <div className="border-t border-white/[0.08]">
                <p className="mx-auto max-w-6xl px-6 py-5 text-[12px] text-zinc-500">
                    © {new Date().getFullYear()} ai.diy
                </p>
            </div>
        </footer>
    );
}
