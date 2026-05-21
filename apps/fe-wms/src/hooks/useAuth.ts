import { useState } from 'react';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { gooeyToast } from 'goey-toast';
import { useUserStore } from '../stores/useUserStore';

// Assuming standard API URL structure based on Nginx routing mapping api.wms.localhost -> be-wms
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.wms.localhost';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const setAuthData = useUserStore(state => state.setAuthData);
  const clearAuth = useUserStore(state => state.clearAuth);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    const loginAction = async () => {
      // 1. Sign in with Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Get the ID Token
      const idToken = await userCredential.user.getIdToken();

      // 3. Exchange ID Token for Session Cookie via our backend API
      const response = await fetch(`${API_BASE_URL}/api/auth/sessionLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        // Clean up Firebase client state if backend login fails
        await firebaseSignOut(auth);
        throw new Error(errorData?.messages?.vi || 'Đăng nhập hệ thống thất bại');
      }

      const { data, messages } = await response.json();
      
      // 4. Update local state
      setAuthData(data.user, data.permissions);
      
      return messages;
    };

    try {
      await gooeyToast.promise(loginAction(), {
        loading: 'Đang xác thực thông tin...',
        success: (msgs) => msgs?.vi || 'Đăng nhập thành công',
        error: (err: any) => err.message || 'Đã xảy ra lỗi khi đăng nhập',
        description: {
          success: 'Hệ thống đang tải dữ liệu của bạn.',
          error: 'Vui lòng kiểm tra lại thông tin và thử lại.',
        },
        action: {
          error: {
            label: 'Thử lại',
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
      // 1. Call Backend to clear cookie
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Không thể đăng xuất phiên làm việc hiện tại');
      }

      // 2. Clear Firebase client state
      await firebaseSignOut(auth);
      
      // 3. Clear Zustand local state
      clearAuth();
    };

    try {
      await gooeyToast.promise(logoutAction(), {
        loading: 'Đang đăng xuất...',
        success: 'Đã đăng xuất',
        error: 'Lỗi đăng xuất',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { login, logout, isLoading };
};
