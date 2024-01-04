export const isAppleOS = () =>
    typeof navigator !== "undefined" &&
    (/Mac/.test(navigator.platform) ||
        (/AppleWebKit/.test(navigator.userAgent) &&
            /Mobile\/\w+/.test(navigator.userAgent)));

export function formatKeyboardShortcut(shortcut: string) {
  if (isAppleOS()) {
    return shortcut.replace("Mod", "⌘");
  } else {
    return shortcut.replace("Mod", "Ctrl");
  }
}

export function mergeCSSClasses(...classes: string[]) {
  return classes.filter((c) => c).join(" ");
}

export class UnreachableCaseError extends Error {
  constructor(val: never) {
    super(`Unreachable case: ${val}`);
  }
}

export function findScrollContainer(
  element: HTMLElement
): HTMLElement | Document {
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const { overflow } = window.getComputedStyle(parent);
    if (overflow.split(" ").every((o) => o === "auto" || o === "scroll")) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return document;
}
