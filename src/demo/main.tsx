import "../../app/globals.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CreateWizard from "../../app/create/CreateWizard";
import OriginReveal from "../../app/create/OriginReveal";
import Skyline from "../../app/Skyline";
import Game from "@/ui/Game";
import { bootDatabase, createLocalPlayer, persistent } from "./boot";
import styles from "./demo.module.css";

type View = "loading" | "gate" | "create" | "reveal" | "play" | "error";

function App() {
  const [view, setView] = useState<View>("loading");
  const [msg, setMsg] = useState("Starting…");
  const [adult, setAdult] = useState(false);

  useEffect(() => {
    bootDatabase(setMsg)
      .then(({ hasAccount, hasCharacter }) => setView(hasCharacter ? "play" : hasAccount ? "create" : "gate"))
      .catch((e) => {
        setMsg(e instanceof Error ? e.message : String(e));
        setView("error");
      });
  }, []);

  if (view === "loading" || view === "error")
    return (
      <main className={styles.boot}>
        <div className={styles.bootArt} aria-hidden="true">
          <Skyline />
        </div>
        <div className={styles.bootCard}>
          <h1>London Life</h1>
          <p className={view === "error" ? "err" : "muted"} role="status">
            {msg}
          </p>
          {view === "error" ? (
            <button className="btn" onClick={() => location.reload()}>
              Try again
            </button>
          ) : (
            <p className="tiny">First load fetches about 17 MB. After that it opens quickly.</p>
          )}
        </div>
      </main>
    );

  if (view === "gate")
    return (
      <main className={styles.boot}>
        <div className={styles.bootArt} aria-hidden="true">
          <Skyline />
        </div>
        <div className={styles.bootCard}>
          <span className="chip gold">Test build · Milestone 1</span>
          <h1>London Life</h1>
          <p className="muted">
            Start with a small room and six needs. Work, cook, take the bus, furnish your place and make London yours.
          </p>
          <ul className={styles.notes}>
            <li>Timers run 20× faster so you can test quickly. A 20-minute sleep takes one minute.</li>
            <li>{persistent ? "Your progress is saved in this browser only." : "This browser can't save progress, so it resets when you close the page."}</li>
            <li>There's no sign-in in the test build. The real game uses accounts on a server.</li>
          </ul>
          <label className={styles.check}>
            <input id="adult" type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>I confirm I am 18 or over. London Life is an adults-only game.</span>
          </label>
          <button
            className="btn block"
            disabled={!adult}
            onClick={async () => {
              await createLocalPlayer();
              setView("create");
            }}
          >
            Make your Londoner
          </button>
        </div>
      </main>
    );

  if (view === "create") return <CreateWizard onCreated={() => setView("reveal")} />;
  if (view === "reveal") return <OriginReveal onEnter={() => setView("play")} />;
  return <Game />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
