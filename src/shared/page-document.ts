import { fillTemplate, fontOverrideCss } from "@/shared/fill-template";
import { fontFaceCss, fontOf, fontStack } from "@/shared/fonts";

export const PREVIEW_CSS =
  "html{width:210mm;min-height:297mm;box-sizing:border-box;background:transparent!important;overflow:hidden}body{background:transparent!important}[data-empty]{background:#eeeeea;color:#565c66;border-radius:2px;padding:0 2px}";

export function pageDocument(
  html: string,
  values: Record<string, string>,
  fontKey: string | null,
  fontUrl: (fileName: string) => string,
  extraCss: string,
): string {
  const font = fontOf(fontKey);
  const filled = fillTemplate(html, values, {
    mark: true,
    fontCss: fontOverrideCss(fontStack(font), fontFaceCss(fontUrl, font)),
  });
  const style = `<style data-preview="">${PREVIEW_CSS}${extraCss}</style>`;
  return /<\/head\s*>/i.test(filled)
    ? filled.replace(/<\/head\s*>/i, `${style}</head>`)
    : style + filled;
}
