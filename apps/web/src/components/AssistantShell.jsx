import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { AskLauncher } from "./AskLauncher";
import {
  preloadAssistantDialog,
  scheduleIdleAssistantDialogPreload,
} from "../lib/assistantDialogLoader";
import "../styles/profile/assistant.css";

// Assistant shell: launcher + dock flight + open listeners stay eager.
// Dialog body, answer machinery, and modal-only icons load through one
// cached preload boundary (see assistantDialogLoader.js).
export const AssistantShell = () => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [ran, setRan] = useState({ query: "", lens: undefined });
  const [Dialog, setDialog] = useState(null);
  const [dialogLoadError, setDialogLoadError] = useState(false);
  const askLauncherRef = useRef(null);
  const location = useLocation();
  const loadGenerationRef = useRef(0);
  const dialogRef = useRef(null);
  const ensureDialogRef = useRef(null);
  const retryButtonRef = useRef(null);
  dialogRef.current = Dialog;

  const close = () => setOpen(false);

  const ensureDialog = () => {
    if (dialogRef.current) return Promise.resolve(dialogRef.current);
    const generation = ++loadGenerationRef.current;
    setDialogLoadError(false);
    return preloadAssistantDialog()
      .then((Loaded) => {
        if (generation !== loadGenerationRef.current) return Loaded;
        dialogRef.current = Loaded;
        setDialog(() => Loaded);
        setDialogLoadError(false);
        return Loaded;
      })
      .catch(() => {
        if (generation !== loadGenerationRef.current) return;
        setDialogLoadError(true);
      });
  };
  ensureDialogRef.current = ensureDialog;

  const requestOpen = () => {
    setOpen(true);
    ensureDialog();
  };

  const retryDialogLoad = () => {
    ensureDialog();
  };

  const warmDialog = () => {
    preloadAssistantDialog().catch(() => {});
  };

  useEffect(() => scheduleIdleAssistantDialogPreload(), []);

  useEffect(() => {
    const resume = location.state?.resumeAssistant;
    if (typeof resume?.query === "string" && resume.query.trim()) {
      const query = resume.query.trim();
      setInputValue(query);
      setRan({ query, lens: resume.roleLens });
      requestOpen();
      return;
    }
    setOpen(false);
  }, [location.key]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        warmDialog();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) ensureDialogRef.current?.();
  }, [open]);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      ensureDialogRef.current?.();
    };
    window.addEventListener("pf:open-assistant", onOpen);
    return () => window.removeEventListener("pf:open-assistant", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open && dialogLoadError) {
      retryButtonRef.current?.focus();
    }
  }, [open, dialogLoadError]);

  return (
    <>
      <AskLauncher ref={askLauncherRef} onIntentPreload={warmDialog} />

      {open && Dialog && (
        <Dialog
          inputValue={inputValue}
          setInputValue={setInputValue}
          ran={ran}
          setRan={setRan}
          onClose={close}
          onPrepareRouteExit={() => askLauncherRef.current?.prepareForRouteExit()}
        />
      )}

      {open && !Dialog && !dialogLoadError && (
        <p className="pf-ask-sr" role="status" aria-live="polite">
          Loading assistant.
        </p>
      )}

      {open && dialogLoadError && (
        <div className="pf-ask-chunk-error" role="alert">
          <p>Assistant could not load. Try again.</p>
          <button type="button" ref={retryButtonRef} onClick={retryDialogLoad}>
            Retry
          </button>
        </div>
      )}
    </>
  );
};
