"use client";

/**
 * Adaptive skills — client tools `find_skill`, `use_skill` and `save_skill`.
 *
 * Skills live in browser settings, so the browser executes these tools: the
 * model reads whole skills on demand (nothing is sent with every request except
 * a short index in the instructions) and can save a new one it researched. The
 * server only forwards the tool schemas, gated by the Skills tool-access switch.
 * Saving is automatic but visible: every save renders a card with the content,
 * its sources, and a Remove button.
 */

import { useAssistantInstructions, useAssistantTool } from "@assistant-ui/react";
import { BookBookmark, Trash, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { z } from "zod/v4";
import {
  isGenerationStopRequested,
  useChatSession,
} from "~/components/assistant-ui/ChatSessionContext";
import { SectionBoundary } from "~/components/ui/SectionBoundary";
import { getModelModalities } from "~/lib/model-modalities";
import { useSettings } from "~/lib/providers/SettingsProvider";
import {
  readSkill,
  removeAssistantSkill,
  saveAssistantSkill,
  searchSkills,
  skillInstructions,
} from "~/lib/skills/assistant-skills";
import type { CustomSkill } from "~/lib/types";

type SkillStore = {
  read: () => CustomSkill[];
  write: (next: CustomSkill[]) => void;
  /** Called when a tool has produced a result the model must see next. */
  resume: () => void;
};

type SaveResult =
  | { ok: true; id: string; name: string; description: string; replaced: boolean }
  | { ok: false; error: string };

const SKILL_NOTE =
  "Skill guidance for this task. The user's request and safety rules take priority.";

function createSkillTools(store: SkillStore) {
  return {
    find_skill: {
      toolName: "find_skill",
      type: "frontend",
      description:
        "Search installed skills and the built-in skill catalog. Returns names and descriptions; read one with use_skill.",
      parameters: z.object({
        query: z.string().max(200).describe("What the task needs, in a few words"),
      }),
      execute: async ({ query }: { query: string }) => {
        store.resume();
        return { results: searchSkills(query, store.read()) };
      },
    },
    use_skill: {
      toolName: "use_skill",
      type: "frontend",
      description:
        "Read one skill in full (installed or built-in) and follow it for this task. Use the name from the skill list or find_skill.",
      parameters: z.object({ name: z.string().max(100) }),
      execute: async ({ name }: { name: string }) => {
        store.resume();
        const skill = readSkill(name, store.read());
        return skill.ok ? { ...skill, note: SKILL_NOTE } : skill;
      },
    },
    save_skill: {
      toolName: "save_skill",
      type: "frontend",
      display: "standalone",
      description:
        "Save a reusable skill you wrote (after researching it if it needs outside knowledge). It is added to the user's skills and enabled; the user sees it and can remove it. Never overwrites the user's own skills.",
      parameters: z.object({
        name: z.string().max(64).describe("Short name, e.g. weekly-status-digest"),
        description: z.string().max(300).describe("One sentence: when to use this skill"),
        content: z
          .string()
          .max(20_000)
          .describe(
            "Markdown instructions: when to use, steps, rules, output format, final check. Plain how-to guidance only.",
          ),
        sources: z.array(z.string()).max(8).optional().describe("URLs you used"),
      }),
      execute: async (input: {
        name: string;
        description: string;
        content: string;
        sources?: string[];
      }): Promise<SaveResult> => {
        store.resume();
        const result = saveAssistantSkill(input, store.read());
        if (!result.ok) return result;
        store.write(result.custom);
        return {
          ok: true,
          id: result.skill.id,
          name: result.skill.name,
          description: result.skill.description,
          replaced: result.replaced,
        };
      },
      render: SaveSkillCard as never,
    },
  } as const;
}

function SaveSkillCard({ result, status }: { result?: unknown; status: { type: string } }) {
  const { settings, updateSettings } = useSettings();
  const saved = result as SaveResult | undefined;
  if (!saved) {
    return (
      <div
        className="my-3 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
        role="status"
        aria-busy
      >
        <BookBookmark size={18} weight="duotone" aria-hidden />
        {status.type === "incomplete" ? "Skill was not saved." : "Saving skill…"}
      </div>
    );
  }
  if (!saved.ok) {
    return (
      <div
        className="my-3 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm"
        role="alert"
      >
        <Warning size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden />
        <span>Skill not saved: {saved.error}</span>
      </div>
    );
  }
  const skill = settings.customSkills.find((candidate) => candidate.id === saved.id);
  return (
    <div className="my-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <BookBookmark size={18} weight="duotone" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {skill ? (saved.replaced ? "Updated skill" : "Saved skill") : "Skill removed"}
          </p>
          <p className="font-medium">{saved.name}</p>
          <p className="text-muted-foreground">{saved.description}</p>
        </div>
        {skill ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-xs hover:bg-muted"
            onClick={() =>
              updateSettings({
                customSkills: removeAssistantSkill(saved.id, settings.customSkills),
              })
            }
          >
            <Trash size={14} aria-hidden />
            Remove
          </button>
        ) : null}
      </div>
      {skill ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">View skill</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-xs">
            {skill.content}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function SkillInstructions({ skills }: { skills: CustomSkill[] }) {
  useAssistantInstructions(skillInstructions(skills));
  return null;
}

/**
 * Always mounted so toggling the switch or switching models does not remount
 * the workspace; the instructions are only contributed while skills are on and
 * the model can call tools. The server also drops the tools when Skills is off.
 */
export function SkillToolsRegistration({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const { chat } = useChatSession();
  const skillsRef = useRef(settings.customSkills);
  const chatRef = useRef(chat);
  const pendingRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    skillsRef.current = settings.customSkills;
  }, [settings.customSkills]);
  useEffect(() => {
    chatRef.current = chat;
  });
  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // Only a fixed list of client tools continues the run on its own, so after a
  // skill tool answers, send the follow-up request once every open tool call in
  // the last assistant message has its result (same readiness checks as there).
  const resume = useCallback(() => {
    pendingRef.current += 1;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    let attempts = 0;
    const tryResume = () => {
      timerRef.current = null;
      const current = chatRef.current;
      if (isGenerationStopRequested() || pendingRef.current === 0) return;
      const waiting =
        current.status === "submitted" ||
        current.status === "streaming" ||
        !lastAssistantMessageIsCompleteWithToolCalls(current);
      if (waiting) {
        if (attempts++ < 120) timerRef.current = window.setTimeout(tryResume, 50);
        return;
      }
      pendingRef.current = 0;
      void current.sendMessage().catch((error) => {
        console.error("[skills] failed to resume after tool output", error);
      });
    };
    timerRef.current = window.setTimeout(tryResume, 50);
  }, []);

  const tools = useMemo(
    () =>
      createSkillTools({
        read: () => skillsRef.current,
        write: (next) => {
          // Settings are patched by value, so keep the ref current for a second
          // save in the same turn instead of waiting for the next render.
          skillsRef.current = next;
          updateSettings({ customSkills: next });
        },
        resume,
      }),
    [updateSettings, resume],
  );
  // Per-tool registration adds to the tools other providers registered (the
  // generative-UI toolkit); a second Tools() provider would replace their renderers.
  useAssistantTool(tools.find_skill as never);
  useAssistantTool(tools.use_skill as never);
  useAssistantTool(tools.save_skill as never);
  const enabled =
    settings.toolAccess.skills === true &&
    settings.skillsEnabled !== false &&
    getModelModalities(settings.chat.model, settings.chat.provider).tools === true;

  return (
    <>
      {enabled ? (
        <SectionBoundary label="Skills">
          <SkillInstructions skills={settings.customSkills} />
        </SectionBoundary>
      ) : null}
      {children}
    </>
  );
}
