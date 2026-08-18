/** Notify the workspace that a signed-in ChatGPT request needs a session refresh. */
export const CHATGPT_REQUEST_FAILURE_EVENT = "prismium:chatgpt-request-failure";

export function notifyChatGPTRequestFailure(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(CHATGPT_REQUEST_FAILURE_EVENT));
}
