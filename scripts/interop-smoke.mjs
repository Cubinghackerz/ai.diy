import { parseChatGPTConversations } from "../app/lib/interop/importers/chatgpt.ts";
import { parseClaudeConversations } from "../app/lib/interop/importers/claude.ts";
import { parseAiDiyExport } from "../app/lib/interop/importers/ai-diy.ts";
import { parseShareGPT } from "../app/lib/interop/importers/sharegpt.ts";
import { parseMarkdownChat } from "../app/lib/interop/importers/markdown.ts";
import { chatToMarkdown, chatToAiDiyJson, markdownBundleZip, safeFilename } from "../app/lib/interop/exporters.ts";
import { unzipSync } from "fflate";

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures++;
    console.error(`FAIL - ${name} ${detail}`);
  }
}

// ─── ChatGPT ────────────────────────────────────────────────
const chatgptSample = [
  {
    title: "My ChatGPT Chat",
    create_time: 1700000000,
    update_time: 1700000100,
    mapping: {
      root: { id: "root", message: null, parent: null, children: ["n1"] },
      n1: {
        id: "n1",
        message: {
          author: { role: "user" },
          create_time: 1700000001,
          content: { content_type: "text", parts: ["Hello there"] },
          metadata: { model_slug: "gpt-4o" },
        },
        parent: "root",
        children: ["n2", "draft"],
      },
      n2: {
        id: "n2",
        message: {
          author: { role: "assistant" },
          create_time: 1700000002,
          content: { content_type: "text", parts: ["Hi!", "How can I help?"] },
          metadata: { model_slug: "gpt-4o" },
        },
        parent: "n1",
        children: [],
      },
      draft: {
        id: "draft",
        message: {
          author: { role: "assistant" },
          create_time: 1700000003,
          content: { content_type: "text", parts: [] },
        },
        parent: "n1",
        children: [],
      },
    },
    current_node: "n2",
  },
];
const gptChats = parseChatGPTConversations(chatgptSample);
check("chatgpt: parses 1 chat", gptChats.length === 1, JSON.stringify(gptChats));
check(
  "chatgpt: title + 2 messages, draft branch skipped",
  gptChats[0]?.title === "My ChatGPT Chat" &&
    gptChats[0]?.messages.length === 2 &&
    gptChats[0]?.messages[0].content === "Hello there",
  JSON.stringify(gptChats[0]),
);
check("chatgpt: multi-part content joined", gptChats[0]?.messages[1].content === "Hi!\nHow can I help?");

// ─── Claude ─────────────────────────────────────────────────
const claudeSample = {
  version: "2.0",
  conversations: [
    {
      id: "conv1",
      title: "Claude Chat",
      created_at: "2025-01-02T03:04:05Z",
      messages: [
        { role: "user", content: [{ type: "text", text: "Write a poem" }], created_at: "2025-01-02T03:04:06Z" },
        { role: "assistant", content: [{ type: "text", text: "Roses are red" }, { type: "image", source: {} }], model: "claude-sonnet-4-5", created_at: "2025-01-02T03:04:10Z" },
        { role: "user", content: "Plain string message", created_at: "2025-01-02T03:05:00Z" },
      ],
    },
  ],
};
const claudeChats = parseClaudeConversations(claudeSample);
check("claude: parses 1 chat", claudeChats.length === 1, JSON.stringify(claudeChats));
check(
  "claude: text blocks + string content, image block ignored",
  claudeChats[0]?.messages.length === 3 && claudeChats[0]?.messages[1].content === "Roses are red",
  JSON.stringify(claudeChats[0]?.messages),
);
check("claude: timestamp parsed", claudeChats[0]?.createdAt === Date.parse("2025-01-02T03:04:05Z"));

// ─── ai.diy backup ──────────────────────────────────────────
const backupSample = {
  version: 1,
  threads: [
    { id: "t1", title: "Backup Chat", createdAt: 1000, updatedAt: 2000, model: "gpt-5", provider: "openai" },
  ],
  messages: [
    { id: "m1", threadId: "t1", role: "user", content: "q?", createdAt: 1001 },
    { id: "m2", threadId: "t1", role: "assistant", content: "a!", createdAt: 1002 },
    { id: "m3", threadId: "t1", role: "tool", content: "hidden", createdAt: 1003 },
  ],
};
const backupChats = parseAiDiyExport(backupSample);
check("ai-diy: 1 chat, tool message skipped", backupChats.length === 1 && backupChats[0]?.messages.length === 2);
check("ai-diy: provider/model kept", backupChats[0]?.model === "gpt-5" && backupChats[0]?.provider === "openai");

// ─── ShareGPT JSONL ─────────────────────────────────────────
const sharegptJsonl = [
  { from: "human", value: "What is 2+2?" },
  { from: "gpt", value: "4" },
].map((m) => JSON.stringify(m)).join("\n");
const notes = [];
const sgChats = parseShareGPT(sharegptJsonl, notes);
check("sharegpt: jsonl parsed", sgChats.length === 1 && sgChats[0]?.messages.length === 2);
const sgJson = [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }];
check("sharegpt: json array parsed", parseShareGPT(sgJson, notes)[0]?.messages.length === 2);

// ─── Markdown round-trip ────────────────────────────────────
const thread = { id: "t1", title: "Report Chat", createdAt: 1700000000000, updatedAt: 1700000010000, model: "gpt-5", provider: "openai" };
const messages = [
  { id: "m1", threadId: "t1", role: "user", content: "Write a report", createdAt: 1700000000001 },
  { id: "m2", threadId: "t1", role: "assistant", content: "Here it is:\n\n```python\nprint(1)\n```", createdAt: 1700000000002 },
];
const md = chatToMarkdown({ thread, messages });
check("markdown export contains headings", md.includes("## User") && md.includes("## Assistant"));
const mdChat = parseMarkdownChat(md, "Report Chat.md");
check("markdown round-trip: 2 messages", mdChat?.messages.length === 2, JSON.stringify(mdChat));
check("markdown round-trip: code block preserved", mdChat?.messages[1].content.includes("```python"));
check("markdown round-trip: frontmatter kept", mdChat?.title === "Report Chat" && mdChat?.model === "gpt-5");
check("markdown: frontmatter-less variant", parseMarkdownChat("## User\nhello\n\n## Assistant\nworld")?.messages.length === 2);

// ─── JSON export & safeFilename ─────────────────────────────
const json = JSON.parse(chatToAiDiyJson({ thread, messages }));
check("json export format tag", json.format === "ai-diy-chat" && Array.isArray(json.messages));
check("safeFilename strips illegal chars", safeFilename("a/b:c*") === "a-b-c");

// ─── ZIP bundle ─────────────────────────────────────────────
const bundle = markdownBundleZip([{ thread, messages }]);
const unzipped = unzipSync(bundle);
const entryName = Object.keys(unzipped)[0];
check("bundle: single entry named by title", entryName === "Report Chat.md", entryName);
const text = new TextDecoder().decode(unzipped[entryName]);
check("bundle: content round-trips", text.includes("## User"));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
