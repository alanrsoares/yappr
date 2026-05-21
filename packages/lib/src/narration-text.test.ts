import { describe, expect, test } from "bun:test";

import { markdownToNarrationText } from "./narration-text";

describe("markdownToNarrationText", () => {
  test("removes markdown markers from headings and emphasis", () => {
    expect(markdownToNarrationText("## Hello **bold** _world_")).toBe(
      "Hello bold world",
    );
  });

  test("keeps link text and drops url noise", () => {
    expect(
      markdownToNarrationText("Read [the docs](https://example.com)."),
    ).toBe("Read the docs.");
  });

  test("turns list items into spoken item markers", () => {
    expect(markdownToNarrationText("- first\n- second")).toBe(
      "Item 1. first Item 2. second",
    );
  });

  test("softens inline code and omits fenced code bodies", () => {
    expect(
      markdownToNarrationText("Use `bun test`.\n\n```ts\nconst x = 1\n```"),
    ).toBe("Use code bun test. ts code block omitted");
  });

  test("summarizes images and tables", () => {
    expect(
      markdownToNarrationText(
        "![diagram](x.png)\n\n| Name | Value |\n| --- | --- |\n| A | 1 |",
      ),
    ).toBe("image: diagram Table with columns: Name, Value");
  });
});
