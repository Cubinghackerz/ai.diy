"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowClockwise, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "~/components/ui/dialog";

export function ChatGPTConnectionRefreshDialog({
    open,
    onOpenChange,
    onRefresh,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRefresh: () => void;
}) {
    const [seconds, setSeconds] = useState(10);
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    useEffect(() => {
        if (!open) return;
        setSeconds(10);
        const interval = window.setInterval(() => {
            setSeconds((current) => Math.max(0, current - 1));
        }, 1000);
        const timeout = window.setTimeout(() => refreshRef.current(), 10_000);
        return () => {
            window.clearInterval(interval);
            window.clearTimeout(timeout);
        };
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-w-md gap-0 rounded-2xl p-0 sm:max-w-md"
            >
                <div className="p-6">
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-success/25 bg-success/10 text-success">
                        <ShieldCheck size={22} weight="fill" />
                    </div>
                    <DialogTitle className="mt-5 text-xl font-semibold tracking-tight">
                        ChatGPT connection saved
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-sm leading-relaxed">
                        Your subscription session is ready. ai.diy will refresh this
                        page in {seconds} seconds to test the connection.
                    </DialogDescription>
                    <div
                        className="mt-5 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 font-mono text-xs text-muted-foreground"
                        role="status"
                        aria-live="polite"
                    >
                        <ArrowClockwise size={14} className="animate-spin" />
                        Refreshing in {seconds}s
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4">
                    <DialogClose render={<Button variant="ghost" size="sm" />}>
                        Stay here
                    </DialogClose>
                    <Button type="button" size="sm" onClick={() => refreshRef.current()}>
                        Refresh now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
