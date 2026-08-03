/**
 * Skill command store — typed "/" command in the composer.
 *
 * Picking a skill from the slash menu marks it as forced: the next chat
 * request carries it as `customSkill` so the server appends it to the system
 * prompt and the model is instructed to apply it, guaranteed.
 */

export type ForcedSkill = {
    name: string;
    content: string;
};

export const forcedSkillStore: { current: ForcedSkill | null } = {
    current: null,
};

/** Built-in skills that can be force-selected without custom content. */
export const BUILTIN_FORCED_SKILLS: ForcedSkill[] = [
    {
        name: "Research",
        content:
            "You MUST handle this request with the research_skill: call the research_skill tool first, then run only the necessary searches and page reads it prescribes, verify material claims against retrieved sources, cite every source URL you used, and report confidence per claim.",
    },
    {
        name: "Ultimate Frontend UI",
        content:
            "You MUST activate and follow the ultimate_frontend_ui skill for this request before writing any code: call the ultimate_frontend_ui tool, then comply with its design thesis, interface-mode classification, state map, responsive/accessibility/performance/security gates, and validation contract.",
    },
    {
        name: "Frontend Design",
        content:
            "You MUST activate and follow the frontend_design_skill for this request: call the frontend_design_skill tool and produce the implementation-ready design brief it defines (hierarchy, responsive behavior, states, accessibility, reusable components) before answering.",
    },
    {
        name: "Python File Creation",
        content:
            "You MUST activate and follow the python_file_creation_skill for this request before creating any file: call the python_file_creation_skill tool, then create the deliverable with browser Pyodide using the verified libraries, save it in the current working directory, validate it, and rely on direct Canvas artifact capture.",
    },
    {
        name: "Word Document",
        content:
            "You MUST activate and follow the word_document_skill for this request before creating any document: call the word_document_skill tool, then produce the .docx deliverable with browser Pyodide (python-docx) following its design contract — cover page, typography, color, section layout, page numbers, tables — save it in the current working directory, validate it, and rely on direct Canvas artifact capture.",
    },
    {
        name: "Skill Architect",
        content:
            "You MUST activate and follow the skill_architect contract for this request: call the create_skill tool and produce a complete SKILL.md with job charter, activation boundaries, inputs, workflow, decision rules, tool rules, output contract, validation, failure handling, and positive/negative evaluation cases.",
    },
];

export function lookupForcedSkill(name: string): ForcedSkill | null {
    return BUILTIN_FORCED_SKILLS.find(
        (skill) => skill.name.toLowerCase() === name.toLowerCase(),
    ) ?? null;
}
