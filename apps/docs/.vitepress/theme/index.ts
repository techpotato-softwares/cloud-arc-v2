import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ArchitectureMap from "./components/ArchitectureMap.vue";
import Mermaid from "./components/Mermaid.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ArchitectureMap", ArchitectureMap);
    app.component("Mermaid", Mermaid);
  }
} satisfies Theme;
