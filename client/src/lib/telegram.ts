declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          query_id?: string;
        };
        initData: string;
        colorScheme: "light" | "dark";
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        platform: string;
        version: string;
        HapticFeedback: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramUserId(): number | null {
  const twa = getTelegramWebApp();
  return twa?.initDataUnsafe?.user?.id ?? null;
}

export function getTelegramUserName(): string | null {
  const twa = getTelegramWebApp();
  const user = twa?.initDataUnsafe?.user;
  if (!user) return null;
  return user.username || user.first_name || null;
}

export function isTelegramEnvironment(): boolean {
  return !!getTelegramWebApp()?.initData;
}

export function initTelegramApp() {
  const twa = getTelegramWebApp();
  if (!twa) return;
  twa.ready();
  twa.expand();
}

export function hapticTap() {
  const twa = getTelegramWebApp();
  try {
    twa?.HapticFeedback?.impactOccurred("light");
  } catch {}
}

export function hapticSuccess() {
  const twa = getTelegramWebApp();
  try {
    twa?.HapticFeedback?.notificationOccurred("success");
  } catch {}
}

export function hapticError() {
  const twa = getTelegramWebApp();
  try {
    twa?.HapticFeedback?.notificationOccurred("error");
  } catch {}
}
