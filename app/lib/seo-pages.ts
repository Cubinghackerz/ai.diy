export const SEO_GUIDES = [
    {
        slug: "self-hosted-ai",
        path: "/self-hosted-ai",
        label: "Self-hosted AI",
        title: "Self-Hosted AI Workspace | ai.diy",
        description:
            "Learn how to run ai.diy as a self-hosted AI workspace with Node.js or Docker, browser-local data, BYOK providers, and clear deployment boundaries.",
        heading: "Self-hosted AI without giving up model choice",
        lastModified: "2026-08-18",
    },
    {
        slug: "local-ai",
        path: "/local-ai",
        label: "Local AI",
        title: "Local AI Workspace for Ollama and LM Studio | ai.diy",
        description:
            "Use Ollama, LM Studio, and other local endpoints in an open-source AI workspace with model switching, browser-local context, and BYOK cloud fallback.",
        heading: "Use local models in the same AI workspace",
        lastModified: "2026-08-18",
    },
    {
        slug: "mcp",
        path: "/mcp",
        label: "MCP",
        title: "MCP AI Client and Workspace | ai.diy",
        description:
            "See how ai.diy connects remote MCP tools, keeps approvals visible, and combines web search with a self-hosted, bring-your-own-key AI workspace.",
        heading: "Connect MCP tools without losing the approval boundary",
        lastModified: "2026-08-18",
    },
    {
        slug: "agents",
        path: "/agents",
        label: "AI agents",
        title: "AI Agent Workspace with Tools and Subagents | ai.diy",
        description:
            "Explore ai.diy Agent Mode, approved subagents, skills, browser Python, and the in-browser Linux environment in an open-source AI agent workspace.",
        heading: "An AI agent workspace with visible tools and approvals",
        lastModified: "2026-08-18",
    },
    {
        slug: "multi-model",
        path: "/multi-model",
        label: "Multi-model",
        title: "Multi-Model AI Workspace | ai.diy",
        description:
            "Compare up to three AI models in parallel with ai.diy Preview, then optionally use a fusion model to synthesize one answer from the results.",
        heading: "Compare models without moving the work",
        lastModified: "2026-08-18",
    },
] as const;

export type SeoGuide = (typeof SEO_GUIDES)[number];

export const INDEXABLE_PUBLIC_PAGES = [
    {
        path: "/",
        lastModified: "2026-08-18",
        changeFrequency: "weekly",
        priority: "1.0",
        image: "/workspace-demo.png",
    },
    ...SEO_GUIDES.map((page) => ({
        path: page.path,
        lastModified: page.lastModified,
        changeFrequency: "monthly",
        priority: "0.8",
    })),
    {
        path: "/privacy",
        lastModified: "2026-08-18",
        changeFrequency: "yearly",
        priority: "0.3",
    },
    {
        path: "/terms",
        lastModified: "2026-08-18",
        changeFrequency: "yearly",
        priority: "0.3",
    },
] as const;

export function seoGuideBySlug(slug: string): SeoGuide {
    const page = SEO_GUIDES.find((candidate) => candidate.slug === slug);
    if (!page) throw new Error(`Unknown SEO guide: ${slug}`);
    return page;
}
