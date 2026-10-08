import { describe, it, expect } from "vitest";
import { fileToBase64, stripImages } from "./helpers";

describe("fileToBase64", () => {
  it("returns the file's bytes as base64 without the data-URL prefix", async () => {
    expect(await fileToBase64(new File(["# hi"], "a.md", { type: "text/markdown" }))).toBe("IyBoaQ==");
  });
});

describe("stripImages", () => {
  it("replaces markdown images with their alt text and leaves links alone", () => {
    expect(stripImages("a ![logo](https://t/x.png) b [link](https://x)")).toBe("a [image: logo] b [link](https://x)");
    expect(stripImages("![](https://t/x.png)")).toBe("[image: ]");
  });
});
