import { describe, expect, it } from "vitest";
import { fillTemplate, fontOverrideCss, stripScripts } from "@/shared/fill-template";
import { findPlaceholders } from "@/shared/placeholders";

const PLAIN = { mark: false, fontCss: "" };
const MARK = { mark: true, fontCss: "" };

function page(body: string): string {
  return `<html><head><title>Q</title></head><body>${body}</body></html>`;
}

describe("fillTemplate edges", () => {
  it("does not fill a {{placeholder}} typed inside a value", () => {
    const html = fillTemplate(page("<p>{{a}} {{b}}</p>"), { a: "{{b}}", b: "B" }, MARK);
    expect(html).toContain('<span data-field="a">{{b}}</span>');
    expect(html).toContain('<span data-field="b">B</span>');
  });

  it("fills every repeat of the same blank", () => {
    const html = fillTemplate(page("<p>{{work}}</p><p>{{work}}</p>"), { work: "सड़क" }, PLAIN);
    expect(html.match(/सड़क/g)).toHaveLength(2);
  });

  it("matches a template blank written in NFD with an NFC value key", () => {
    const nfd = "ऩाम";
    const nfc = nfd.normalize("NFC");
    expect(nfd).not.toBe(nfc);
    const template = page(`<p>{{${nfd}}}</p>`);
    expect(findPlaceholders(template)).toEqual([nfc]);
    expect(fillTemplate(template, { [nfc]: "100" }, PLAIN)).toContain("<p>100</p>");
  });

  it("keeps emoji and Devanagari in values and escapes a script typed into an attribute", () => {
    const html = fillTemplate(
      page('<img alt="{{a}}"><p>{{a}}</p>'),
      { a: '"><script>alert(1)</script> 🙏 श्री' },
      MARK,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain('alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; 🙏 श्री"');
  });

  it("escapes a blank's name when it shows the empty grey box", () => {
    const html = fillTemplate(page("<p>{{a&b}}</p>"), {}, MARK);
    expect(html).toContain('<span data-field="a&amp;b" data-empty="">a&amp;b</span>');
  });

  it("removes scripts written in any letter case and with attributes", () => {
    const html = stripScripts(
      '<ScRiPt type="module">alert(1)</sCrIpT ><SCRIPT src="x.js"></SCRIPT><p ONCLICK="x">ok</p>',
    );
    expect(html).not.toMatch(/script|onclick|alert/i);
    expect(html).toContain("<p>ok</p>");
  });

  it("keeps body text that only looks like an event handler", () => {
    const html = fillTemplate(page("<p>Rate for one = Rs 500</p>"), {}, PLAIN);
    expect(html).toContain("<p>Rate for one = Rs 500</p>");
  });

  it("does not put a span inside an attribute whose value holds a >", () => {
    const html = fillTemplate(page('<a title="a>b {{x}}">link</a>'), { x: "v" }, MARK);
    expect(html).toContain('<a title="a>b v" data-tpl=');
    expect(html).toContain(">link</a>");
    expect(html).not.toContain("<span");
  });

  it("adds a head-less override only once and keeps the template text after it", () => {
    const css = fontOverrideCss('"Mukta", sans-serif', "");
    const html = fillTemplate(
      "<body><p>{{a}}</p></body>",
      { a: "1" },
      { mark: true, fontCss: css },
    );
    expect(html.match(/<style data-font="">/g)).toHaveLength(1);
    expect(html).toContain('<span data-field="a">1</span>');
  });
});
