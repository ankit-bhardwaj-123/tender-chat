import { describe, expect, it } from "vitest";
import { findPlaceholders } from "@/shared/placeholders";

describe("findPlaceholders", () => {
  it("finds names in the order they first appear", () => {
    expect(findPlaceholders("<p>{{officer}}</p><p>{{department}}</p><p>{{date}}</p>")).toEqual([
      "officer",
      "department",
      "date",
    ]);
  });

  it("keeps a repeated name once", () => {
    expect(findPlaceholders("{{work_name}} … {{rate}} … {{work_name}}")).toEqual([
      "work_name",
      "rate",
    ]);
  });

  it("trims spaces and line breaks inside the braces", () => {
    expect(findPlaceholders("{{ officer }} {{\n  date\n}}")).toEqual(["officer", "date"]);
  });

  it("works with Hindi names", () => {
    expect(findPlaceholders("<b>{{अधिकारी}}</b> {{कार्य का नाम}}")).toEqual([
      "अधिकारी",
      "कार्य का नाम",
    ]);
  });

  it("returns an empty list when there are no placeholders", () => {
    expect(findPlaceholders("<html><body><p>नमस्ते</p></body></html>")).toEqual([]);
  });

  it("skips empty braces", () => {
    expect(findPlaceholders("{{}} {{   }} {{name}}")).toEqual(["name"]);
  });

  it("keeps markup and script text inside the braces as plain names", () => {
    expect(findPlaceholders("{{<script>}} {{{rate}}}")).toEqual(["<script>", "rate"]);
  });

  it("shows a Hindi name once when it is written in two Unicode forms", () => {
    const composed = "क़ीमत";
    const decomposed = "क़ीमत";
    expect(findPlaceholders(`{{${composed}}} {{${decomposed}}}`)).toEqual([
      decomposed.normalize("NFC"),
    ]);
  });
});
