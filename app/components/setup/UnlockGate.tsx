/**
 * UnlockGate — shown when settings are encrypted and the passphrase has not
 * yet been entered for this session. Replaces the chat setup flow with a
 * passphrase prompt.
 */

import { useState, useCallback } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { hapticConfirm } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { Lock, Key, XCircle, WarningCircle } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";

export function UnlockGate() {
    const { unlockWithPassphrase, unlocking, unlockError, clearUnlockError } =
        useSettings();
    const [passphrase, setPassphrase] = useState("");
    const [showPass, setShowPass] = useState(false);

    const handleUnlock = useCallback(async () => {
        hapticConfirm();
        const ok = await unlockWithPassphrase(passphrase);
        if (!ok) {
            setPassphrase("");
        }
    }, [passphrase, unlockWithPassphrase]);

    return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-background">
            <div className="relative z-10 flex w-full max-w-md flex-col gap-6 px-4 py-12">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Lock size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            Settings are encrypted
                        </h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Your API keys and preferences are AES-GCM encrypted
                            in this browser. Enter your passphrase to unlock
                            your settings and continue.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <Input
                            type={showPass ? "text" : "password"}
                            autoComplete="off"
                            spellCheck={false}
                            value={passphrase}
                            onChange={(e) => {
                                setPassphrase(e.target.value);
                                if (unlockError) clearUnlockError();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && passphrase.trim() && !unlocking) {
                                    e.preventDefault();
                                    void handleUnlock();
                                }
                            }}
                            placeholder="Enter your passphrase"
                            className="h-11 rounded-xl pr-10 font-mono text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                            aria-label={showPass ? "Hide" : "Show"}
                        >
                            <Key size={14} />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="text-left text-[10px] text-muted-foreground hover:text-foreground"
                    >
                        {showPass ? "Hide" : "Show"} passphrase
                    </button>

                    <Button
                        type="button"
                        disabled={!passphrase.trim() || unlocking}
                        onClick={() => void handleUnlock()}
                        className="h-11 w-full rounded-xl text-sm font-semibold"
                    >
                        {unlocking ? (
                            <>
                                <span className="loading-spinner mr-2" />
                                Decrypting…
                            </>
                        ) : (
                            "Unlock settings"
                        )}
                    </Button>
                </div>

                {unlockError ? (
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <XCircle size={14} className="mt-0.5 shrink-0" />
                        {unlockError}
                    </div>
                ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <WarningCircle size={14} className="mt-0.5 shrink-0" />
                        The passphrase is never stored or sent anywhere. If you
                        forget it, you can reset encryption from Settings →
                        Encryption (this will permanently remove the old encrypted
                        settings).
                    </div>
                )}
            </div>
        </div>
    );
}
