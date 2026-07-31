/** Light haptic tap for interactive controls (no-ops when unsupported). */
export function haptic(ms = 10) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(ms);
    }
}

export function hapticSelect() {
    haptic(8);
}

export function hapticConfirm() {
    haptic(14);
}
