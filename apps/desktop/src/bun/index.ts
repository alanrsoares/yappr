import { BrowserWindow, Updater, Utils } from "electrobun/bun";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR: using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR.",
      );
    }
  }
  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Yappr",
  url,
  // Keep macOS traffic lights, drop the system titlebar so the chassis chrome
  // reads as the title bar. Custom drag region lives on `<SerialPlate>` via
  // `-webkit-app-region: drag`.
  titleBarStyle: "hiddenInset",
  // Nudge the close/min/max trio down + right so they sit inside the brand
  // strip without colliding with the engraved "Yappr · Y-1" lettering.
  trafficLightOffset: { x: 16, y: 22 },
  frame: {
    width: 1180,
    height: 720,
    x: 220,
    y: 140,
  },
});

// Clean shutdown: exit the Bun process when the last window closes so the
// launcher quits cleanly instead of leaving the main process orphaned.
mainWindow.on("close", () => {
  Utils.quit();
});

console.log("Yappr desktop started.");
