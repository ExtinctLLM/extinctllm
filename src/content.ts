import TextClassifier from "./utils/textClassifier";
import { Readability } from "@mozilla/readability";

const textClassifier = new TextClassifier(1024);
const threshold = 0.5;

window.onload = () => {
  const article = new Readability(document.cloneNode(true) as Document).parse();
  /* Should return an object with the following properties (https://github.com/mozilla/readability):
   *
   *   - `title`: article title
   *   - `content`: HTML string of processed article content
   *   - `textContent`: text content of the article, with all the HTML tags removed
   *   - `length`: length of an article, in characters
   *   - `excerpt`: article description, or short excerpt from the content
   *   - `byline`: author metadata
   *   - `dir`: content direction
   *   - `siteName`: name of the site
   *   - `lang`: content language
   *   - `publishedTime`: published time
   *
   * For our intents, only `title` and `textContent` should be fed into the analyzer.
   */

  if (article) {
    const corpus: string = (
      article.title +
      "\n\n" +
      article.textContent
    ).trim();

    const [matchMap, alpha]: [Record<number, number>, number] =
      textClassifier.analyze(corpus);
    const score: number = textClassifier.calculateScore(matchMap);
    const normalizedScore: number = textClassifier.normalizeScore(
      corpus,
      score,
      alpha,
      2.25,
    );
    const exceededThreshold: boolean = normalizedScore > threshold;

    console.group(
      "%cCorpus Scan Results\n%cfrom %cExtinctLLM",
      "font-size: 2em;",
      "font-size: 1em; color: gray;",
      "font-style: italic;",
    );

    const results = [
      { Metric: "Corpus Size", Value: `${corpus.length} chars` },
      { Metric: "Match Map", Value: JSON.stringify(matchMap) },
      { Metric: "Unscaled Alpha", Value: alpha },
      { Metric: "Raw Score", Value: score },
      {
        Metric: "Normalized Score",
        Value: normalizedScore,
      },
    ];

    console.table(results);
    console.groupEnd();

    if (exceededThreshold) {
      alert(
        `This page may contain a considerable amount of AI-generated text. The normalized score is ${(normalizedScore * 100).toFixed(2)}%.`,
      );
    }
  }
};
