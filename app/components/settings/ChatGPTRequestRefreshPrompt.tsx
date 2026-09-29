import { useEffect, useState } from "react";
import { ChatGPTConnect } from "~/components/settings/ChatGPTConnect";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "~/components/ui/dialog";
import { CHATGPT_REQUEST_FAILURE_EVENT } from "~/lib/chatgpt-refresh";
import { useChatGPTSession } from "~/lib/providers/ChatGPTSessionProvider";

export function ChatGPTRequestRefreshPrompt() {
    const { refresh, status } = useChatGPTSession();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onFailure = () => {
            void refresh().then((next) => {
                if (next === "expired" || next === "unauthenticated") setOpen(true);
            });
        };
        window.addEventListener(CHATGPT_REQUEST_FAILURE_EVENT, onFailure);
        return () => window.removeEventListener(CHATGPT_REQUEST_FAILURE_EVENT, onFailure);
    }, [refresh]);

    useEffect(() => {
        if (status === "authenticated") setOpen(false);
    }, [status]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md gap-4 rounded-2xl p-5 sm:max-w-md">
                <div>
                    <DialogTitle className="text-lg font-semibold tracking-tight">
                        Reconnect ChatGPT
                    </DialogTitle>
                    <DialogDescription className="mt-1.5">
                        Your ChatGPT session ended, so that message couldn&apos;t be sent. Reconnect
                        and resend — no page reload needed.
                    </DialogDescription>
                </div>
                <ChatGPTConnect />
            </DialogContent>
        </Dialog>
    );
}
