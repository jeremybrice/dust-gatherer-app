"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { isIosSafari, isStandalone } from "@/lib/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPanel() {
  const { t } = useT();
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone(window));
    setIos(isIosSafari(navigator));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "dismissed") setDismissed(true);
    setPromptEvent(null);
  }

  if (standalone) {
    return (
      <section className="settings-block">
        <p className="notice">{t("installed")}</p>
      </section>
    );
  }

  return (
    <section className="settings-block">
      {promptEvent && !dismissed && (
        <p>
          <button type="button" className="btn" onClick={install}>
            {t("install_app")}
          </button>
        </p>
      )}
      {ios && (
        <div>
          <h2>{t("install_ios_title")}</h2>
          <ol className="install-steps">
            <li>{t("install_ios_share")}</li>
            <li>{t("install_ios_add")}</li>
          </ol>
        </div>
      )}
    </section>
  );
}
