import TextClassifier from "@/utils/textClassifier";
import { Readability } from "@mozilla/readability";

const textClassifier = new TextClassifier(1024);
const threshold = 0.5;

function scanDocument() {
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

    console.group(
      "%cCorpus Scan Status\n%cfrom %cExtinctLLM",
      "font-size: 2em;",
      "font-size: 1em; color: gray;",
      "font-style: italic;",
    );

    if (corpus.split(/\s+/).length < 200) {
      browser.runtime.sendMessage({
        type: `SET_CLASSIFIER_SCORE_${window.location.hostname}`,
        value: "ARTICLE_TOO_SHORT",
      });

      console.log(
        "The article is too short to classify accurately. No scan will be initiated.",
      );
      console.groupEnd();

      return;
    }

    const [matchMap, alpha]: [Record<number, number>, number] =
      textClassifier.analyze(corpus);
    const score: number = textClassifier.calculateScore(matchMap);
    const normalizedScore: number = textClassifier.normalizeScore(
      corpus.length,
      score,
      alpha,
      2.25,
    );
    const exceededThreshold: boolean = normalizedScore > threshold;

    browser.runtime.sendMessage({
      type: `SET_CLASSIFIER_SCORE_${window.location.hostname}`,
      value: normalizedScore,
    });

    const results = [
      { Metric: "Corpus Size", Value: `${corpus.length} chars` },
      { Metric: "Match Map", Value: matchMap },
      { Metric: "Unscaled Alpha", Value: alpha },
      { Metric: "Raw Score", Value: score },
      {
        Metric: "Normalized Score",
        Value: normalizedScore,
      },
    ];

    console.table(results);
    console.groupEnd();

    // if (exceededThreshold) {
    //   alert(
    //     "A considerable amount of this page may contain content written or refined by AI.",
    //   );
    // }
  }
}

window.onload = () => {
  scanDocument();
};
