globalThis.process ??= {};
globalThis.process.env ??= {};
import { S as createComponent, g as addAttribute, h as renderHead, s as renderSlot, u as renderTemplate, x as createAstro } from "./server_C1h4Dnza.mjs";
import "./compiler_w6KFsEAb.mjs";
//#region src/layouts/BaseLayout.astro
createAstro("https://astro.build");
var $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$BaseLayout;
	const { title, description = "SFF Builder helps you plan small-form-factor PC builds with clearance-aware compatibility data." } = Astro.props;
	return renderTemplate`<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"${addAttribute(description, "content")}><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"><title>${title}</title><script>
      const storedTheme = localStorage.getItem("theme");
      if (storedTheme === "light" || storedTheme === "dark") {
        document.documentElement.dataset.theme = storedTheme;
      }
    <\/script>${renderHead($$result)}</head><body class="bg-canvas text-ink antialiased">${renderSlot($$result, $$slots["default"])}</body></html>`;
}, "D:/dev/sff-website/src/layouts/BaseLayout.astro", void 0);
//#endregion
export { $$BaseLayout as t };
