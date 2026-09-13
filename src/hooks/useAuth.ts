import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { REMEMBER_EMAIL_KEY } from '../domain/constants';
import { isEmailAllowed } from '../utils/access';
import type { SessionUser } from '../domain/types';

export function toSessionUser(user: FirebaseUser): SessionUser {
  return { uid: user.uid, email: user.email };
}

export function loginErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code.includes('network') || code.includes('unavailable')) return 'تعذر الاتصال. تحقق من الإنترنت وحاول مجدداً.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'بيانات الدخول غير صحيحة.';
  }
  if (code.includes('too-many-requests')) return 'محاولات كثيرة. انتظر قليلاً وحاول مجدداً.';
  return 'فشل تسجيل الدخول. حاول مجدداً.';
}

export function useAuth(): {
  user: SessionUser | null;
  authLoading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
} {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      /* Allowlist gate: signed-in users outside the list are signed out. */
      const email = firebaseUser.email ?? '';
      void isEmailAllowed(email).then((allowed) => {
        if (allowed) {
          setUser(toSessionUser(firebaseUser));
        } else {
          void signOut(auth);
          setUser(null);
          setLoginError('هذا الحساب غير مصرح له بالدخول — تواصل مع صاحب التطبيق.');
        }
        setAuthLoading(false);
      });
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string, remember: boolean): Promise<void> => {
    setLoginError(null);
    try {
      /* Gate first: reject unauthorized emails before touching Firebase auth. */
      const allowed = await isEmailAllowed(email);
      if (!allowed) {
        const message = 'هذا الحساب غير مصرح له بالدخول — تواصل مع صاحب التطبيق.';
        setLoginError(message);
        throw new Error(message);
      }
      await signInWithEmailAndPassword(auth, email, password);
      if (remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('غير مصرح')
          ? error.message
          : loginErrorMessage(error);
      setLoginError(message);
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
  };

  return { user, authLoading, login, logout, loginError };
}
