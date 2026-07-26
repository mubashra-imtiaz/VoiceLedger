import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateEmail as fbUpdateEmail,
  updatePassword as fbUpdatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FbUser,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type Transaction = {
  id: string;
  items: string;
  total: number;
  paid: number;
  balance: number;
  dueDate?: string;
  createdAt: string;
  signature?: string;
};

export type Payment = { id: string; amount: number; createdAt: string; transactionId?: string };

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  transactions: Transaction[];
  payments: Payment[];
  createdAt: string;
};

export type SimpleUser = { uid: string; email: string | null };

type Result = { ok: boolean; error?: string };

type Ctx = {
  user: SimpleUser | null;
  authReady: boolean;
  customers: Customer[];
  signUp: (email: string, password: string) => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  updateEmail: (email: string) => Promise<Result>;
  updatePassword: (current: string, next: string) => Promise<Result>;
  resetPassword: (email: string) => Promise<Result>;
  deleteAccount: (password?: string) => Promise<Result>;
  addOrder: (
    name: string,
    tx: Omit<Transaction, "id" | "createdAt" | "balance">,
    phone?: string,
  ) => Promise<void>;
  updateCustomerPhone: (customerId: string, phone: string) => Promise<void>;
  addPayment: (customerId: string, amount: number, transactionId?: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  totalBalance: (c: Customer) => number;
  todaysRevenue: () => number;
};

const StoreCtx = createContext<Ctx | null>(null);

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "No account found with this email. Please sign up first.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password too weak (minimum 6 characters).";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/requires-recent-login":
      return "Please sign in again to continue.";
    default:
      return (e as { message?: string })?.message || "Authentication failed.";
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Keep parent user document in sync with user's email only
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      setAuthReady(true);

      if (u) {
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              email: u.email || "",
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (err) {
          console.error("Error syncing user document:", err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Realtime customers subscription for the signed-in user
  useEffect(() => {
    if (!fbUser) {
      setCustomers([]);
      return;
    }
    const q = query(
      collection(db, "users", fbUser.uid, "customers"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Customer[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Customer> & { createdAt?: unknown };
          return {
            id: d.id,
            name: (data.name as string) || "Customer",
            phone: (data.phone as string) || undefined,
            transactions: (data.transactions as Transaction[]) || [],
            payments: (data.payments as Payment[]) || [],
            createdAt:
              typeof data.createdAt === "string"
                ? data.createdAt
                : new Date().toISOString(),
          };
        });
        setCustomers(items);
      },
      (err) => {
        console.error("customers snapshot error", err);
      },
    );
    return () => unsub();
  }, [fbUser]);

  const user: SimpleUser | null = useMemo(
    () => (fbUser ? { uid: fbUser.uid, email: fbUser.email } : null),
    [fbUser],
  );

  const signUp: Ctx["signUp"] = async (email, password) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (res.user) {
        await setDoc(
          doc(db, "users", res.user.uid),
          {
            email: res.user.email || email,
            createdAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const signIn: Ctx["signIn"] = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const updateEmail: Ctx["updateEmail"] = async (email) => {
    if (!auth.currentUser) return { ok: false, error: "Not signed in" };
    try {
      await fbUpdateEmail(auth.currentUser, email);
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { email },
        { merge: true },
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const updatePassword: Ctx["updatePassword"] = async (current, next) => {
    if (!auth.currentUser || !auth.currentUser.email)
      return { ok: false, error: "Not signed in" };
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await fbUpdatePassword(auth.currentUser, next);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const resetPassword: Ctx["resetPassword"] = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const deleteAccount: Ctx["deleteAccount"] = async (password) => {
    if (!auth.currentUser) return { ok: false, error: "Not signed in" };
    try {
      if (password && auth.currentUser.email) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      const uid = auth.currentUser.uid;
      await deleteUser(auth.currentUser);
      await deleteDoc(doc(db, "users", uid)).catch(() => { });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  };

  const addOrder: Ctx["addOrder"] = async (name, tx, phone) => {
    if (!fbUser) return;
    const cleanName = name.trim();
    if (!cleanName) return;

    await setDoc(
      doc(db, "users", fbUser.uid),
      { email: fbUser.email || "", updatedAt: new Date().toISOString() },
      { merge: true },
    );

    const existing = customers.find(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase(),
    );
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      balance: Math.max(0, (tx.total || 0) - (tx.paid || 0)),
      items: tx.items,
      total: tx.total,
      paid: tx.paid,
      ...(tx.dueDate ? { dueDate: tx.dueDate } : {}),
      ...(tx.signature ? { signature: tx.signature } : {}),
    };
    if (existing) {
      const ref = doc(db, "users", fbUser.uid, "customers", existing.id);
      await updateDoc(ref, {
        transactions: [transaction, ...existing.transactions],
        ...(phone ? { phone } : {}),
      });
    } else {
      const id = crypto.randomUUID();
      const ref = doc(db, "users", fbUser.uid, "customers", id);
      await setDoc(ref, {
        name: cleanName,
        ...(phone ? { phone } : {}),
        transactions: [transaction],
        payments: [],
        createdAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      });
    }
  };

  const addPayment: Ctx["addPayment"] = async (customerId, amount, transactionId) => {
    if (!fbUser || !amount || amount <= 0) return;
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    let remaining = amount;
    const txs = [...c.transactions].reverse().map((t) => {
      if (remaining <= 0) return t;
      if (transactionId && t.id !== transactionId) return t;
      const take = Math.min(t.balance, remaining);
      remaining -= take;
      return { ...t, paid: t.paid + take, balance: t.balance - take };
    }).reverse();
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount,
      createdAt: new Date().toISOString(),
      ...(transactionId ? { transactionId } : {}),
    };
    const ref = doc(db, "users", fbUser.uid, "customers", customerId);
    await updateDoc(ref, {
      transactions: txs,
      payments: [payment, ...c.payments],
    });
  };

  const updateCustomerPhone: Ctx["updateCustomerPhone"] = async (customerId, phone) => {
    if (!fbUser) return;
    await updateDoc(doc(db, "users", fbUser.uid, "customers", customerId), { phone });
  };

  const deleteCustomer: Ctx["deleteCustomer"] = async (customerId) => {
    if (!fbUser) return;
    await deleteDoc(doc(db, "users", fbUser.uid, "customers", customerId));
  };

  const totalBalance = useCallback(
    (c: Customer) => c.transactions.reduce((sum, t) => sum + t.balance, 0),
    [],
  );

  const todaysRevenue = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    let sum = 0;
    for (const c of customers) {
      for (const t of c.transactions) if (t.createdAt.slice(0, 10) === today) sum += t.paid;
      for (const p of c.payments) if (p.createdAt.slice(0, 10) === today) sum += p.amount;
    }
    return sum;
  }, [customers]);

  return (
    <StoreCtx.Provider
      value={{
        user,
        authReady,
        customers,
        signUp,
        signIn,
        signOut,
        updateEmail,
        updatePassword,
        resetPassword,
        deleteAccount,
        addOrder,
        updateCustomerPhone,
        addPayment,
        deleteCustomer,
        totalBalance,
        todaysRevenue,
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}