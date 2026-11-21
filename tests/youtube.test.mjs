import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeInfo } from "../src/lib/youtube.ts";

describe("extractYouTubeInfo", () => {
  it("extracts videoId from standard watch URLs", () => {
    const info = extractYouTubeInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.deepEqual(info, {
      videoId: "dQw4w9WgXcQ",
      startTime: undefined,
      originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("extracts videoId and numeric start time from youtu.be URLs", () => {
    const info = extractYouTubeInfo("https://youtu.be/dQw4w9WgXcQ?t=120");
    assert.equal(info?.videoId, "dQw4w9WgXcQ");
    assert.equal(info?.startTime, 120);
  });

  it("parses h/m/s timestamps accurately", () => {
    const info = extractYouTubeInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m30s");
    assert.equal(info?.videoId, "dQw4w9WgXcQ");
    assert.equal(info?.startTime, 3750);
  });

  it("supports shorts, embed, live, and mobile URLs", () => {
    assert.equal(extractYouTubeInfo("https://www.youtube.com/shorts/abcdefghijk")?.videoId, "abcdefghijk");
    assert.equal(extractYouTubeInfo("https://www.youtube.com/embed/abcdefghijk")?.videoId, "abcdefghijk");
    assert.equal(extractYouTubeInfo("https://www.youtube.com/live/abcdefghijk")?.videoId, "abcdefghijk");
    assert.equal(extractYouTubeInfo("m.youtube.com/watch?v=abcdefghijk")?.videoId, "abcdefghijk");
  });

  it("returns null for invalid, relative, or non-YouTube URLs", () => {
    assert.equal(extractYouTubeInfo("/posts/123"), null);
    assert.equal(extractYouTubeInfo("https://vimeo.com/123456"), null);
    assert.equal(extractYouTubeInfo("https://www.youtube.com/watch?v=short"), null);
    assert.equal(extractYouTubeInfo("not a url"), null);
  });
});
