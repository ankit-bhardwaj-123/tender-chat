import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  fillTemplate,
  fontOverrideCss,
  stripScripts,
  valueHtml,
} from "@/shared/fill-template";
import { findPlaceholders } from "@/shared/placeholders";

const PLAIN = { mark: false, fontCss: "" };
const MARK = { mark: true, fontCss: "" };

function page(body: string, head = "<title>Q</title>"): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

describe("fillTemplate", () => {
  it("fills values and escapes markup typed into them", () => {
    const html = fillTemplate(page("<p>{{name}}</p>"), { name: "<script>x</script> & co" }, PLAIN);
    expect(html).toContain("<p>&lt;script&gt;x&lt;/script&gt; &amp; co</p>");
  });

  it("turns line breaks in a value into <br>", () => {
    expect(valueHtml("a\nb\r\nc")).toBe("a<br>b<br>c");
  });

  it("matches Hindi names with spaces the same way findPlaceholders reads them", () => {
    const template = page("<p>{{  अधिकारी   का नाम }}</p>");
    const [name] = findPlaceholders(template);
    expect(name).toBe("अधिकारी का नाम");
    const html = fillTemplate(template, { [name ?? ""]: "श्री राम" }, MARK);
    expect(html).toContain('<span data-field="अधिकारी का नाम">श्री राम</span>');
  });

  it("shows an empty blank as its name in a grey box only when marking", () => {
    const template = page("<p>{{rate}}</p>");
    expect(fillTemplate(template, {}, MARK)).toContain(
      '<span data-field="rate" data-empty="">rate</span>',
    );
    expect(fillTemplate(template, {}, PLAIN)).toContain("<p></p>");
  });

  it("puts the plain value, not a span, inside a tag attribute or the head", () => {
    const template = page('<img alt="{{seal}}"><p>{{seal}}</p>', "<title>{{seal}}</title>");
    const html = fillTemplate(template, { seal: 'A"B' }, MARK);
    expect(html).toContain('<img alt="A&quot;B">');
    expect(html).toContain("<title>A&quot;B</title>");
    expect(html).toContain('<span data-field="seal">A&quot;B</span>');
  });

  it("leaves an empty {{ }} as it is", () => {
    expect(fillTemplate(page("<p>{{ }}</p>"), {}, MARK)).toContain("<p>{{ }}</p>");
  });

  it("removes scripts and inline event handlers", () => {
    const html = fillTemplate(
      page(
        '<script>alert(1)</script><p onclick="alert(2)" class="x">{{a}}</p><script src="x.js"/>',
      ),
      { a: "ok" },
      PLAIN,
    );
    expect(html).not.toMatch(/script|onclick|alert/i);
    expect(html).toContain('<p class="x">ok</p>');
  });

  it("puts the font override first in <head>, and works without a <head>", () => {
    const css = fontOverrideCss('"Mukta", system-ui, sans-serif', "@font-face{}");
    const withHead = fillTemplate(
      page("<p>x</p>", "<style>body{font-family:Arial}</style>"),
      {},
      {
        mark: true,
        fontCss: css,
      },
    );
    expect(withHead.indexOf('<style data-font="">')).toBeLessThan(withHead.indexOf("Arial"));
    expect(withHead).toContain(
      'html,body,body *{font-family:"Mukta", system-ui, sans-serif !important}',
    );
    const noHead = fillTemplate("<p>{{a}}</p>", { a: "1" }, { mark: true, fontCss: css });
    expect(noHead.startsWith('<style data-font="">')).toBe(true);
    expect(noHead).toContain('<span data-field="a">1</span>');
  });
});

describe("escapeHtml and stripScripts", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("removes single- and double-quoted and bare handlers", () => {
    expect(stripScripts(`<a onmouseover='x' onload=y href="z">`)).toBe('<a href="z">');
  });
});
