import patterns from "../data/patterns.yaml";

const compiledPatterns: Record<number, RegExp[]> = Object.fromEntries(
  Object.entries(patterns as Record<string, string[]>).map(
    ([score, expressions]) => [
      Number(score),
      expressions.map((regex) => new RegExp(regex, "gimu")),
    ],
  ),
);

export default class TextClassifier {
  chunkSize: number;

  constructor(chunkSize: number) {
    this.chunkSize = chunkSize;
  }

  analyze(corpus: string): [Record<number, number>, number] {
    let matchMap: Record<number, number> = {};
    let alpha: number = 0;

    const size: number = corpus.length;
    const step: number = Math.floor(this.chunkSize / 1.25); // in case of overlap

    for (let i = 0; i < size; i += step) {
      const chunk: string = corpus.slice(i, i + this.chunkSize);
      for (const [score, expressions] of Object.entries(compiledPatterns)) {
        for (const regex of expressions) {
          const matches: number = (chunk.match(regex) ?? []).length;
          if (matches > 0) {
            alpha += Math.log1p(matches) * Number(score);
            matchMap[Number(score)] = (matchMap[Number(score)] || 0) + matches;
          }
        }
      }
    }

    return [matchMap, alpha];
  }

  calculateScore(matchMap: Record<number, number>): number {
    return Object.entries(matchMap).reduce(
      (acc, [score, matches]) => (acc += Number(score) * matches),
      0,
    );
  }

  normalizeScore(
    corpusLength: number,
    score: number,
    alpha: number,
    scale: number,
  ): number {
    const scaledAlpha: number = Math.abs(alpha) ** scale;
    return 1 - Math.exp((-scaledAlpha * score) / corpusLength);
  }
}
