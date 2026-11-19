import { fontFaceCss } from "@/shared/fonts";

const CSS = fontFaceCss((fileName) => `/fonts/${fileName}`);

export function FontFaces() {
  return <style>{CSS}</style>;
}
