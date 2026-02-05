import patterns from "@/data/patterns.yaml";

const compiledPatterns: Record<number, RegExp[]> = Object.fromEntries(
  Object.entries(patterns as Record<string, string[]>).map(
    ([score, expressions]) => [
      Number(score),
      expressions.map((regex) => new RegExp(regex, "gimus")),
    ],
  ),
);

export default class TextClassifier {
  chunkSize: number;
  wLex: number;
  wBurst: number;

  constructor(chunkSize: number, wLex: number, wBurst: number) {
    this.chunkSize = chunkSize;
    this.wLex = wLex;
    this.wBurst = wBurst;
  }

  analyze(corpus: string): [Record<number, number>, number, number] {
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

    const tokens: string[] = corpus.toLowerCase().match(/\b\w+\b/g) || [];
    const uniqueTokens: Set<string> = new Set(tokens);
    const lexicalDiversity = uniqueTokens.size / tokens.length;

    const sentences: string[] = corpus.split(/(?<=[.!?])\s+/);
    const sentenceLengths: number[] = sentences.map(
      (s) => s.split(/\b\w+\b/).length,
    );
    const meanSentenceLength: number =
      sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance: number =
      sentenceLengths.reduce((a, b) => a + (b - meanSentenceLength) ** 2, 0) /
      sentenceLengths.length; // average sentence length variance
    const burstiness: number = Math.sqrt(variance) / meanSentenceLength;

    const linguisticScore: number =
      lexicalDiversity * this.wLex +
      (1 - Math.min(burstiness, 2) / 2) * this.wBurst;

    return [matchMap, alpha, linguisticScore];
  }

  calculatePatternScore(matchMap: Record<number, number>): number {
    return Object.entries(matchMap).reduce(
      (acc, [score, matches]) => (acc += Number(score) * matches),
      0,
    );
  }

  normalizeScore(
    corpusLength: number,
    patternScore: number,
    alpha: number,
    linguisticScore: number,
    scale: number,
  ): number {
    const scaledAlpha: number = Math.abs(alpha) ** scale;
    return (
      1 -
      Math.exp((-scaledAlpha * patternScore ** linguisticScore) / corpusLength)
    );
  }
}
