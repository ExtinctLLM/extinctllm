import TextClassifier from "@/utils/textClassifier";
import { Readability } from "@mozilla/readability";
import { setData, getData } from "@/utils/storage";

const chunkSize: number = 1024;
const wLex: number = 0.7;
const wBurst: number = 0.7;
const threshold: number = 0.5;

const textClassifier: TextClassifier = new TextClassifier(
  chunkSize,
  wLex,
  wBurst,
);

async function scanDocument() {
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

    const currentDomain: string | null = window.location.hostname;
    let exceptionsList: string[] | null = await getData("exceptionsList");

    if (!exceptionsList) {
      exceptionsList = [];
      await setData("exceptionsList", exceptionsList);
    }

    if (exceptionsList.includes(currentDomain)) {
      console.log(
        "This domain has been whitelisted. No scan will be initiated.",
      );
      console.groupEnd();
      return;
    }

    if (
      exceptionsList.includes(
        window.location.hostname + window.location.pathname,
      )
    ) {
      console.log("This page has been whitelisted. No scan will be initiated.");
      console.groupEnd();
      return;
    }

    if (corpus.split(/\s+/).length < 200) {
      browser.runtime.sendMessage({
        type: `SET_CLASSIFIER_SCORE_${currentDomain}`,
        value: "ARTICLE_TOO_SHORT",
      });

      console.log(
        "The article is too short to classify accurately. No scan will be initiated.",
      );
      console.groupEnd();

      return;
    }

    const [matchMap, alpha, linguisticScore]: [
      Record<number, number>,
      number,
      number,
    ] = textClassifier.analyze(corpus);
    const patternScore: number = textClassifier.calculatePatternScore(matchMap);
    const normalizedScore: number = textClassifier.normalizeScore(
      corpus.length,
      patternScore,
      alpha,
      linguisticScore,
      2.25,
    );
    const exceededThreshold: boolean = normalizedScore > threshold;

    browser.runtime.sendMessage({
      type: `SET_CLASSIFIER_SCORE_${currentDomain}`,
      value: normalizedScore,
    });

    const results = [
      { Metric: "Corpus Size", Value: `${corpus.length} chars` },
      { Metric: "Match Map", Value: matchMap },
      { Metric: "Unscaled Alpha", Value: alpha },
      { Metric: "Raw Pattern Score", Value: patternScore },
      { Metric: "Raw Linguistic Score", Value: linguisticScore },
      {
        Metric: "Normalized Score",
        Value: normalizedScore,
      },
    ];

    console.table(results);
    console.groupEnd();

    if (exceededThreshold) {
      showDetectionAlert(normalizedScore);
    }
  }
}

// This function creates the warning alert and injects it onto the page
function showDetectionAlert(confidence: number) {
  const alertBox: HTMLDivElement = document.createElement("div");
  alertBox.style.cssText = `
    all: initial;
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 2147483647;
    box-sizing: border-box;
    max-width: 384px;
    top: 20px;
    right: 20px;
    margin: 0;
    padding: 20px;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-size: 14px;
    border: none;
    border-radius: 12px;
    background-color: #4f2125;
    color: #f2e1e1;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;
  document.body.appendChild(alertBox);

  const label: HTMLParagraphElement = document.createElement("p");
  label.style.cssText = `
    all: initial;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    color: #f2e1e1;
  `;
  label.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
      fill="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;">
      <path d="M11 9h2v6h-2zm0 8h2v2h-2z"></path><path d="M12.87 2.51c-.35-.63-1.4-.63-1.75 0l-9.99 18c-.17.31-.17.69.01.99.18.31.51.49.86.49h20c.35 0 .68-.19.86-.49a1 1 0 0 0 .01-.99zM3.7 20 12 5.06 20.3 20z"></path>
    </svg>
    Content Authenticity Warning
  `;
  alertBox.appendChild(label);

  const message: HTMLParagraphElement = document.createElement("p");
  message.style.cssText = `
    all: initial;
    margin: 0;
    padding: 0;
    font-size: 14px;
    line-height: 1.5;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    color: #f2e1e1;
  `;
  message.innerHTML = `
    We are
    <span
      style="
        all: unset;
        font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
        font-weight: 600;
      ">
      ${(confidence * 100).toFixed(2)}%
    </span>
    confident this page contains AI-written content. Please verify important information.
  `;
  alertBox.appendChild(message);

  const buttonContainer: HTMLDivElement = document.createElement("div");
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  alertBox.appendChild(buttonContainer);

  const buttonStyles: string = `
    all: initial;
    cursor: pointer;
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding: 8px 16px;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    border: none;
    border-radius: 12px;
    color: #dbcbcc;
  `;

  const dismissButton: HTMLButtonElement = document.createElement("button");
  dismissButton.textContent = "Dismiss";
  dismissButton.style.cssText = `
    ${buttonStyles}
    background-color: #6b3439;
  `;
  dismissButton.onmouseenter = () =>
    (dismissButton.style.backgroundColor = "#7d3f45");
  dismissButton.onmouseleave = () =>
    (dismissButton.style.backgroundColor = "#6b3439");
  dismissButton.onclick = () => alertBox.remove();
  buttonContainer.appendChild(dismissButton);

  const returnButton: HTMLButtonElement = document.createElement("button");
  returnButton.textContent = "Return";
  returnButton.style.cssText = `
    ${buttonStyles}
    background-color: #913e44;
  `;
  returnButton.onmouseenter = () =>
    (returnButton.style.backgroundColor = "#a05359");
  returnButton.onmouseleave = () =>
    (returnButton.style.backgroundColor = "#913e44");
  returnButton.onclick = () => window.history.back();
  buttonContainer.appendChild(returnButton);
}

document.addEventListener("DOMContentLoaded", () => {
  scanDocument();
});
