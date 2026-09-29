import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChatGPTMark } from "@opencoredev/loginwithchatgpt-react";
import {
    ArrowSquareOut,
    Check,
    CheckCircle,
    Copy,
    LockKey,
    ShieldCheck,
    WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    formatCountdown,
    formatPlan,
    secondsUntil,
    splitDeviceCode,
} from "~/lib/chatgpt-errors";
import {
    useChatGPTSession,
    type ChatGPTSessionStatus,
} from "~/lib/providers/ChatGPTSessionProvider";
import { cn } from "~/lib/utils";

const FOCUS =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function PillButton({ className, children, ...props }: React.ComponentProps<"button">) {
    return (
        <button
            type="button"
            className={cn(
                "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-foreground px-4 text-sm font-medium text-background transition-[background-color,transform] duration-150 hover:bg-foreground/85 active:translate-y-px disabled:pointer-events-none disabled:opacity-60",
                FOCUS,
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

function Spinner() {
    return (
        <span
            aria-hidden
            className="size-3.5 animate-spin rounded-[2px] border-2 border-current border-t-transparent"
        />
    );
}

function useNow(intervalMs: number) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}

const SUBTITLES: Record<ChatGPTSessionStatus, string> = {
    loading: "Checking your session…",
    unauthenticated: "Use the models in your ChatGPT plan. No API key.",
    starting: "Opening OpenAI…",
    pending: "Waiting for approval on openai.com",
    authenticated: "",
    expired: "Your session ended",
    error: "Can't reach the server",
};

export function ChatGPTConnect({ className }: { className?: string }) {
    const session = useChatGPTSession();
    const [consentOpen, setConsentOpen] = useState(false);
    const { status } = session;
    const connected = status === "authenticated";

    const subtitle = connected
        ? (session.user?.email ?? "Connected")
        : SUBTITLES[status];

    let action: ReactNode = null;
    if (status === "unauthenticated" || status === "expired") {
        action = (
            <PillButton onClick={() => setConsentOpen(true)}>
                <ChatGPTMark width={16} height={16} />
                {status === "expired" ? "Reconnect" : "Continue with ChatGPT"}
            </PillButton>
        );
    } else if (status === "starting") {
        action = (
            <PillButton disabled>
                <Spinner />
                Connecting…
            </PillButton>
        );
    } else if (status === "error") {
        action = (
            <Button
                type="button"
                size="sm"
                variant="outline"
                className={FOCUS}
                onClick={() => void session.refresh()}
            >
                Retry
            </Button>
        );
    } else if (connected) {
        action = (
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className={FOCUS}
                onClick={() => void session.logout()}
            >
                Disconnect
            </Button>
        );
    }

    return (
        <section
            aria-label="ChatGPT subscription"
            className={cn("rounded-xl border border-border/70 bg-muted/20 p-3.5", className)}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#10a37f] text-white">
                    <ChatGPTMark width={18} height={18} />
                    {connected ? (
                        <span className="cgpt-pop absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-[2px] bg-success text-black ring-2 ring-background">
                            <Check size={9} weight="bold" />
                        </span>
                    ) : null}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                    <p className="text-sm leading-tight font-medium">ChatGPT</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
                {action}
            </div>

            {session.error && !connected && status !== "pending" ? (
                <p role="alert" className="mt-3 text-xs leading-relaxed text-destructive">
                    {session.error}
                </p>
            ) : null}

            {status === "expired" ? (
                <p className="mt-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    ChatGPT signed this workspace out (the session expired or was revoked). Reconnect to
                    keep using your plan.
                </p>
            ) : null}

            {status === "pending" ? <DeviceCodePanel /> : null}
            {connected ? <ConnectedDetails /> : null}

            {status === "unauthenticated" || status === "expired" ? (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <LockKey size={12} className="mt-0.5 shrink-0" />
                    You sign in on openai.com. Tokens stay in an encrypted server session, never in
                    browser storage. Not an official OpenAI product.
                </p>
            ) : null}

            <ConsentDialog
                open={consentOpen}
                onOpenChange={setConsentOpen}
                onContinue={() => {
                    setConsentOpen(false);
                    session.login();
                }}
            />
        </section>
    );
}

function DeviceCodePanel() {
    const session = useChatGPTSession();
    const now = useNow(1000);
    const remaining = secondsUntil(session.expiresAt, now);
    const groups = splitDeviceCode(session.userCode);
    let index = 0;

    return (
        <div className="cgpt-rise mt-3.5 border-t border-border/60 pt-3.5">
            <p className="text-xs text-muted-foreground">
                Enter this code on OpenAI to finish signing in.
            </p>
            <button
                type="button"
                onClick={() => void session.copyCode()}
                aria-label={`Sign-in code ${session.userCode}. Activate to copy.`}
                className={cn("mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg", FOCUS)}
            >
                {groups.map((group, g) => (
                    <span key={g} className="flex items-center gap-3">
                        <span className="flex gap-1.5">
                            {[...group].map((char) => {
                                const i = index++;
                                return (
                                    <span
                                        key={i}
                                        style={{ "--i": i } as CSSProperties}
                                        className="cgpt-rise grid h-11 w-9 place-items-center rounded-lg border border-border bg-background font-mono text-xl font-medium text-foreground"
                                    >
                                        {char}
                                    </span>
                                );
                            })}
                        </span>
                        {g < groups.length - 1 ? (
                            <span aria-hidden className="h-px w-2.5 bg-border" />
                        ) : null}
                    </span>
                ))}
            </button>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <PillButton onClick={session.reopen}>
                    <ArrowSquareOut size={14} weight="bold" />
                    Open OpenAI
                </PillButton>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("h-9 rounded-[2px] px-3", FOCUS)}
                    onClick={() => void session.copyCode()}
                >
                    {session.copied ? (
                        <Check size={14} weight="bold" />
                    ) : (
                        <Copy size={14} />
                    )}
                    {session.copied ? "Copied" : "Copy code"}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn("h-9 rounded-[2px] px-3", FOCUS)}
                    onClick={session.cancel}
                >
                    Cancel
                </Button>
            </div>

            <div
                role="status"
                aria-live="polite"
                className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
            >
                <span className="relative grid size-2 place-items-center text-success">
                    <span className="cgpt-ping absolute inset-0 rounded-[2px]" />
                    <span className="relative size-2 rounded-[2px] bg-current" />
                </span>
                <span>Waiting for approval</span>
                <span aria-hidden className="tabular-nums">
                    · expires in {formatCountdown(remaining)}
                </span>
            </div>
            {session.popupBlocked ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Your browser blocked the sign-in window. Use Open OpenAI.
                </p>
            ) : session.copied ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    Code copied. Paste it on OpenAI.
                </p>
            ) : null}
        </div>
    );
}

function ConnectedDetails() {
    const session = useChatGPTSession();
    const plan = formatPlan(session.user?.plan);
    const isFree = /free/i.test(session.user?.plan ?? "");
    const { verify } = session;

    return (
        <div className="cgpt-rise mt-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
                {plan ? (
                    <span className="rounded-[2px] border border-border px-2 py-0.5 font-medium">
                        {plan} plan
                    </span>
                ) : null}
                {verify.state === "running" ? (
                    <span className="animate-pulse text-muted-foreground">
                        Testing connection…
                    </span>
                ) : null}
                {verify.state === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle size={14} weight="fill" />
                        Verified · {verify.models} model{verify.models === 1 ? "" : "s"} available
                    </span>
                ) : null}
                {verify.state === "error" ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                        <WarningCircle size={14} weight="fill" />
                        {verify.message}
                    </span>
                ) : null}
                {verify.state !== "running" ? (
                    <button
                        type="button"
                        onClick={() => void session.verifyConnection()}
                        className={cn(
                            "rounded text-muted-foreground underline underline-offset-3 hover:text-foreground",
                            FOCUS,
                        )}
                    >
                        {verify.state === "idle" ? "Test connection" : "Test again"}
                    </button>
                ) : null}
            </div>
            {session.offline ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    Offline. Showing your last known status.
                </p>
            ) : null}
            {session.ephemeral ? (
                <p className="mt-2.5 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    This server can&apos;t keep sign-ins across restarts, so you&apos;ll have to
                    reconnect after it recycles. The host fixes this by setting LWC_SECRET and a
                    Redis store (see DEPLOYMENT.md).
                </p>
            ) : null}
            {isFree ? (
                <p className="mt-2.5 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    Free plans have a low Codex usage quota. If chats fail with a usage limit, wait
                    for the reset, upgrade ChatGPT, or switch to a BYOK provider.
                </p>
            ) : null}
        </div>
    );
}

function ConsentDialog({
    open,
    onOpenChange,
    onContinue,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onContinue: () => void;
}) {
    const points = [
        {
            icon: <ChatGPTMark width={16} height={16} />,
            title: "It spends your plan",
            body: "ai.diy sends chats on your ChatGPT plan until you disconnect. Heavy use can exhaust your usage limits.",
        },
        {
            icon: <ShieldCheck size={16} />,
            title: "Prompts pass through this server",
            body: "They travel from your browser to this ai.diy server, then to OpenAI. Continue only if you trust whoever runs it.",
        },
        {
            icon: <LockKey size={16} />,
            title: "No password shared",
            body: "You sign in on openai.com. Disconnect any time to delete the stored session.",
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-w-md gap-0 rounded-2xl p-0 sm:max-w-md"
            >
                <div className="p-5">
                    <DialogTitle className="text-lg leading-snug font-semibold tracking-tight">
                        Connect your ChatGPT plan
                    </DialogTitle>
                    <DialogDescription className="mt-1.5">
                        Three things to know before you continue.
                    </DialogDescription>
                    <ul className="mt-4 flex flex-col gap-3">
                        {points.map((point) => (
                            <li key={point.title} className="flex gap-3">
                                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-foreground">
                                    {point.icon}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">{point.title}</span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {point.body}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <DialogFooter className="m-0 rounded-b-2xl px-5 py-4">
                    <DialogClose render={<Button variant="ghost" className={FOCUS} />}>
                        Cancel
                    </DialogClose>
                    <PillButton onClick={onContinue}>Continue to OpenAI</PillButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
