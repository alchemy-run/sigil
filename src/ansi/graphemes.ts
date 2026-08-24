const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The canonical grapheme segmentation service for measurement and rasterization. */
export function* graphemes(text: string): Generator<string> {
  for (const { segment } of segmenter.segment(text)) {
    yield segment;
  }
}
