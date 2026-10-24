import { configureMoney } from "./format";
import { syncFinance } from "./features/finance/ledger";
import { materializeFollowups } from "./features/scheduling/followupLogic";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { readState, saveState, type ClinicState } from "./data";
interface Store {
  state: ClinicState;
  setState: Dispatch<SetStateAction<ClinicState>>;
  notify: (message: string, tone?: "success" | "error") => void;
  toastType: "success" | "error";
  toast: string;
  clearToast: () => void;
}
const Context = createContext<Store | null>(null);
export function ClinicProvider({ children }: { children: ReactNode }) {
  const [state, updateState] = useState(readState);
  const currentState = useRef(state);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const setState: Dispatch<SetStateAction<ClinicState>> = useCallback(
    (change: SetStateAction<ClinicState>) => {
      const next = materializeFollowups(syncFinance(typeof change === "function" ? change(currentState.current) : change));
      // Persist accepted changes before closing a form or navigating away.
      // The ref also gives consecutive functional updates the latest state.
      currentState.current = next;
      try { saveState(next); }
      catch {
        setToastType("error");
        setToast("Browser storage is full. These changes are available only in this session.");
      }
      updateState(next);
    }, []);
  configureMoney(state.adminSettings?.currency);
  useEffect(() => {
    try {
      saveState(currentState.current);
    } catch {
      setToastType("error");
      setToast(
        "Browser storage is full. These changes are available only in this session.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{
        state,
        setState,
        notify: (message, tone = "success") => {
          setToastType(tone);
          setToast(message);
        },
        toastType,
        toast,
        clearToast: () => setToast(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useClinic() {
  const value = useContext(Context);
  if (!value) throw new Error("ClinicProvider required");
  return value;
}
export function addActivity(
  s: ClinicState,
  message: string,
  patientId?: string,
): ClinicState {
  return {
    ...s,
    activity: [
      {
        id: crypto.randomUUID(),
        message,
        at: new Date().toISOString(),
        patientId:
          patientId || s.patients.find((p) => message.includes(p.name))?.id,
      },
      ...s.activity,
    ].slice(0, 500),
  };
}
