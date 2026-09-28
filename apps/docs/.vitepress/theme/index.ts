import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ArchitectureMap from "./components/ArchitectureMap.vue";
import Mermaid from "./components/Mermaid.vue";
import LayerStack from "./components/LayerStack.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ArchitectureMap", ArchitectureMap);
    app.component("Mermaid", Mermaid);
    app.component("LayerStack", LayerStack);
  }
} satisfies Theme;
