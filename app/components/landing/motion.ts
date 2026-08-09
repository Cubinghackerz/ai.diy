/** Shared motion tokens — UI chrome ≤300ms; custom ease, never linear for motion. */
export const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
export const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)";
export const DURATION_UI = "200ms";
export const DURATION_MICRO = "150ms";
export const PRESS_SCALE = "0.96";

export const revealClass =
    "landing-reveal translate-y-3 opacity-0 blur-[2px] transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0 data-[in=true]:translate-y-0 data-[in=true]:opacity-100 data-[in=true]:blur-0";
