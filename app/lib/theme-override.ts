/** Routes that hardcode their own dark stage (the setup gate) pin the theme
 * classes for their whole lifetime, so token-styled children (dialogs, cards)
 * match the stage even when the saved theme is light. */
let forcedDark: boolean | null = null;

export function setThemeOverride(value: boolean | null): void {
    forcedDark = value;
}

export function getThemeOverride(): boolean | null {
    return forcedDark;
}
