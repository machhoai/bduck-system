import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import { auth } from "../lib/firebase";
import { useUserStore } from "../stores/useUserStore";
import { useMfaStore } from "../stores/useMfaStore";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const setAuthData = useUserStore((state) => state.setAuthData);
  const clearAuth = useUserStore((state) => state.clearAuth);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    const loginAction = async () => {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/auth/sessionLogin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        await firebaseSignOut(auth);
        throw createDetailedApiError(
          response,
          errorData,
          "Dang nhap he thong that bai",
        );
      }

      const { data, messages } = await response.json();
      // Extract unique role_ids from user_warehouse_roles for task matching
      const roleIds = (data.roles || [])
        .filter((r: any) => r.is_active)
        .map((r: any) => r.role_id)
        .filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i);
      setAuthData(data.user, data.permissions, roleIds);

      // Lock screen on login
      useMfaStore.getState().lockScreen();

      return messages;
    };

    try {
      await gooeyToast.promise(loginAction(), {
        loading: "Đang xác thực thông tin...",
        success: (msgs) => msgs?.vi || "Đăng nhập thành công",
        error: "Đã xảy ra lỗi khi đăng nhập",
        description: {
          success: "Hệ thống đang tải dữ liệu của bạn.",
          error: "Vui lòng kiểm tra lại thông tin và thử lại.",
        },
        action: {
          error: {
            label: "Thử lại",
            onClick: () => login(email, password),
          },
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);

    const logoutAction = async () => {
      let backendSessionCleared = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });

        backendSessionCleared = response.ok;
      } catch (error) {
        backendSessionCleared = false;
        console.error("[useAuth] logout backend request failed:", error);
      }

      await firebaseSignOut(auth);
      clearAuth();

      return { backendSessionCleared };
    };

    try {
      await gooeyToast.promise(logoutAction(), {
        loading: "Đang đăng xuất...",
        success: ({ backendSessionCleared }) =>
          backendSessionCleared
            ? "Đã đăng xuất"
            : "Đã đăng xuất khỏi thiết bị này",
        error: "Lỗi đăng xuất",
        description: {
          success:
            "Phiên cục bộ đã được xóa. Nếu API đang tắt, cookie máy chủ sẽ được xóa khi kết nối lại.",
          error: "Vui lòng thử lại hoặc kiểm tra kết nối API.",
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    const resetAction = async () => {
      await sendPasswordResetEmail(auth, email);
    };

    try {
      await gooeyToast.promise(resetAction(), {
        loading: "Đang gửi email khôi phục...",
        success: "Đã gửi email khôi phục",
        error: "Lỗi gửi email",
        description: {
          success: "Vui lòng kiểm tra hộp thư đến của bạn để đặt lại mật khẩu.",
          error: "Không thể gửi email. Vui lòng kiểm tra lại địa chỉ email.",
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { login, logout, resetPassword, isLoading };
};
