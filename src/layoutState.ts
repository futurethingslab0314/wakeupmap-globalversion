export type MobileView = "main" | "journal" | "detail";

interface MobileViewInput {
  showDatabase: boolean;
  hasSelectedRecord: boolean;
  hasSelectedContinent: boolean;
  hasSelectedGroup: boolean;
}

export function getMobileView(input: MobileViewInput): MobileView {
  if (input.showDatabase) {
    return "journal";
  }

  if (input.hasSelectedRecord || input.hasSelectedContinent || input.hasSelectedGroup) {
    return "detail";
  }

  return "main";
}

export function getMobileNavVisibility(view: MobileView): {
  showLeft: boolean;
  showCenter: boolean;
  showRight: boolean;
} {
  if (view === "journal") {
    return { showLeft: false, showCenter: false, showRight: true };
  }

  if (view === "detail") {
    return { showLeft: true, showCenter: false, showRight: false };
  }

  return { showLeft: true, showCenter: true, showRight: true };
}

export function getHeaderAnimationState(isMobileViewport: boolean, view: MobileView): {
  x: string;
  opacity: number;
} {
  if (view === "detail") {
    return { x: "-120%", opacity: 0 };
  }

  if (view === "journal") {
    return isMobileViewport
      ? { x: "-120%", opacity: 0 }
      : { x: "calc(100vw - 480px)", opacity: 1 };
  }

  return { x: "0%", opacity: 1 };
}
