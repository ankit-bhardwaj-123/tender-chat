import { describe, expect, it } from "vitest";
import { withBody } from "@/lib/page-editing";

describe("withBody", () => {
  it("puts the edited body back between the template's own body tags", () => {
    const source =
      '<html><head><title>{{t}}</title><style>p{color:red}</style></head><body class="a"><p>old</p></body></html>';
    expect(withBody(source, "<p>new {{a}}</p>")).toBe(
      '<html><head><title>{{t}}</title><style>p{color:red}</style></head><body class="a"><p>new {{a}}</p></body></html>',
    );
  });

  it("keeps the styles of a template that has no body tag", () => {
    expect(withBody("<style>p{margin:0}</style><p>old</p>", "<p>new</p>")).toBe(
      "<style>p{margin:0}</style><p>new</p>",
    );
  });

  it("keeps body tags written in capitals", () => {
    expect(withBody("<HTML><BODY><p>x</p></BODY></HTML>", "<p>y</p>")).toBe(
      "<HTML><BODY><p>y</p></BODY></HTML>",
    );
  });
});
