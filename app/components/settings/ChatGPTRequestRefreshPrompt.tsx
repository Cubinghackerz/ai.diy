"use client";

import { useEffect, useState } from "react";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { ChatGPTConnectionRefreshDialog } from "~/components/settings/ChatGPTConnectionRefreshDialog";
import { CHATGPT_REQUEST_FAILURE_EVENT } from "~/lib/chatgpt-refresh";

export function ChatGPTRequestRefreshPrompt() {
    const { isAuthenticated } = useLoginWithChatGPT();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onRequestFailure = () => {
            if (isAuthenticated) setOpen(true);
        };
        window.addEventListener(CHATGPT_REQUEST_FAILURE_EVENT, onRequestFailure);
        return () =>
            window.removeEventListener(CHATGPT_REQUEST_FAILURE_EVENT, onRequestFailure);
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) setOpen(false);
    }, [isAuthenticated]);

    return (
        <ChatGPTConnectionRefreshDialog
            open={open}
            mode="request-failed"
            onOpenChange={setOpen}
            onRefresh={() => window.location.reload()}
        />
    );
}
