import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Yappr",
    identifier: "money.printr.yappr.desktop",
    version: "0.0.1",
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    // Pin renderer per platform. Keep `bundleCEF: false` everywhere so we ship
    // a thin bundle and use each OS's system webview.
    // macOS: WebKit — smaller + lower-memory than CEF, and consistent with the
    // existing native renderer behavior we've been testing against.
    // Linux: CEF strongly recommended by upstream (WebKit2GTK has gaps).
    // Windows: WebView2 (system Edge engine).
    mac: {
      bundleCEF: false,
      defaultRenderer: "native",
    },
    linux: {
      bundleCEF: false,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: false,
      defaultRenderer: "native",
    },
  },
} satisfies ElectrobunConfig;
