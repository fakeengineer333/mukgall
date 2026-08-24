// Web Notification API Utility for Mukgall

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("mukgall_notifications_enabled", "true");
      return true;
    }
  } catch (err) {
    console.warn("[Notification] Permission request failed:", err);
  }
  return false;
}

export function isNotificationEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === "granted" && localStorage.getItem("mukgall_notifications_enabled") !== "false";
}

export function setNotificationEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mukgall_notifications_enabled", enabled ? "true" : "false");
}

export async function sendChatNotification({
  title,
  body,
  roomId,
  icon = "/icons/icon-chat.png",
}: {
  title: string;
  body: string;
  roomId?: string;
  icon?: string;
}) {
  if (!isNotificationEnabled()) return;

  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: icon || "/icons/icon-chat.png",
    badge: "/icons/badge-96.png",
    tag: roomId ? `chat-room-${roomId}` : "chat-notification",
    renotify: true,
  };

  try {
    // 1. If service worker is ready, use registration.showNotification (recommended on mobile/PWA)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          ...options,
          data: { url: roomId ? `/chat/${roomId}` : "/chat" },
        });
        return;
      }
    }

    // 2. Standard Web Notification fallback for desktop browser tabs
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (roomId) {
        window.location.href = `/chat/${roomId}`;
      } else {
        window.location.href = "/chat";
      }
      notification.close();
    };
  } catch (e) {
    console.warn("[Notification] Failed to show notification:", e);
  }
}
