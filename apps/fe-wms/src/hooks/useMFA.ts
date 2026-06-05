import { useEffect } from "react";
import { useMfaStore } from "../stores/useMfaStore";

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useMFA = () => {
  const { isLocked, lastActiveTime, lockScreen, unlockScreen, updateActivity } = useMfaStore();

  useEffect(() => {
    // Check idle timeout every minute
    const interval = setInterval(() => {
      if (Date.now() - lastActiveTime > IDLE_TIMEOUT_MS && !isLocked) {
        lockScreen();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [lastActiveTime, isLocked, lockScreen]);

  useEffect(() => {
    const handleActivity = () => {
      // Throttle activity updates to once per minute to avoid excessive re-renders
      if (Date.now() - lastActiveTime > 60000) {
        updateActivity();
      }
    };

    // Attach to standard DOM events
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [lastActiveTime, updateActivity]);

  return { isLocked, lockScreen, unlockScreen };
};
