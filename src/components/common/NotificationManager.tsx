"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  setNotificationEnabled,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";

export function NotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (isNotificationSupported()) {
      setSupported(true);
      setPermission(Notification.permission);
      setEnabled(isNotificationEnabled());
    }
  }, []);

  if (!supported) return null;

  const handleToggle = async () => {
    if (permission !== "granted") {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermission("granted");
        setEnabled(true);
      }
    } else {
      const next = !enabled;
      setNotificationEnabled(next);
      setEnabled(next);
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
