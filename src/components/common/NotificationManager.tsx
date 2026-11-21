"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, Check } from "lucide-react";
import {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  setNotificationEnabled,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

export function NotificationToggle() {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => isNotificationSupported(),
    () => false
  );

  const [overrideState, setOverrideState] = useState<{
    permission?: NotificationPermission;
    enabled?: boolean;
  }>({});

  if (!supported) return null;

  const permission =
    overrideState.permission ??
    (typeof Notification !== "undefined" ? Notification.permission : "default");
  const enabled = overrideState.enabled ?? isNotificationEnabled();

  const handleToggle = async () => {
    if (permission !== "granted") {
      const granted = await requestNotificationPermission();
      if (granted) {
        setOverrideState({ permission: "granted", enabled: true });
      }
    } else {
      const next = !enabled;
      setNotificationEnabled(next);
      setOverrideState((prev) => ({ ...prev, enabled: next }));
    }
  };

  return (
    <Button
      variant={enabled ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl ${
        enabled
          ? "border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/30"
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30"
      }`}
    >
      {enabled ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          알림 켜짐
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          알림 켜기
        </>
      )}
    </Button>
  );
}
