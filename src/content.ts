import browser from "webextension-polyfill";
import { Readability } from "@mozilla/readability";
import { setData, getData } from "@/utils/storage";
import TextClassifier from "@/utils/textClassifier";

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
      "%cCorpus Scan Status\n%cfrom %cExtinction",
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
      await browser.runtime.sendMessage({
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

    await browser.runtime.sendMessage({
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

    if (exceededThreshold) showDetectionAlert(normalizedScore);
  }
}

// This function creates the warning alert and injects it onto the page
function showDetectionAlert(confidence: number) {
  const originalBodyOverflow: string = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const wrapper: HTMLDivElement = document.createElement("div");
  wrapper.style.all = "unset";
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.zIndex = "2147483647";
  wrapper.style.lineHeight = "1.5";
  wrapper.style.fontFamily =
    "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
  const shadow = wrapper.attachShadow({ mode: "closed" });
  document.body.appendChild(wrapper);

  const background: HTMLDivElement = document.createElement("div");
  background.style.position = "fixed";
  background.style.display = "flex";
  background.style.justifyContent = "center";
  background.style.alignItems = "center";
  background.style.width = "100%";
  background.style.height = "100%";
  background.style.top = "0";
  background.style.left = "0";
  background.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  background.style.backdropFilter = "blur(36px)";
  background.style.transition = "opacity 0.5s ease, backdrop-filter 0.5s ease";
  shadow.appendChild(background);

  const alertBox: HTMLDivElement = document.createElement("div");
  alertBox.style.position = "fixed";
  alertBox.style.display = "flex";
  alertBox.style.flexDirection = "column";
  alertBox.style.justifyContent = "center";
  alertBox.style.gap = "24px";
  alertBox.style.boxSizing = "border-box";
  alertBox.style.width = "800px";
  alertBox.style.margin = "0";
  alertBox.style.padding = "40px";
  alertBox.style.borderRadius = "24px";
  alertBox.style.backgroundColor = "#212b4f";
  alertBox.style.color = "#aab9ed";

  function adjustAlertBoxSize() {
    if (window.innerWidth <= 800) {
      alertBox.style.width = "100%";
      alertBox.style.height = "100%";
      alertBox.style.borderRadius = "0";
    } else {
      alertBox.style.width = "800px";
      alertBox.style.height = "auto";
      alertBox.style.borderRadius = "24px";
    }
  }

  adjustAlertBoxSize();
  window.addEventListener("resize", adjustAlertBoxSize);
  background.appendChild(alertBox);

  const label: HTMLParagraphElement = document.createElement("p");
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "8px";
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "8px";
  label.style.margin = "0";
  label.style.padding = "0";
  label.style.fontSize = "24px";
  label.style.fontWeight = "600";
  label.style.color = "#aab9ed";
  label.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"  
      fill="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;">
      <path d="M11 9h2v6h-2zm0 8h2v2h-2z"></path><path d="M12.87 2.51c-.35-.63-1.4-.63-1.75 0l-9.99 18c-.17.31-.17.69.01.99.18.31.51.49.86.49h20c.35 0 .68-.19.86-.49a1 1 0 0 0 .01-.99zM3.7 20 12 5.06 20.3 20z"></path>
    </svg>
    Potential AI Content
  `;
  alertBox.appendChild(label);

  const message: HTMLDivElement = document.createElement("div");
  message.style.display = "flex";
  message.style.flexDirection = "column";
  message.style.gap = "20px";
  message.style.margin = "0";
  message.style.padding = "0";
  message.style.fontSize = "20px";
  message.style.color = "#aab9ed";
  message.innerHTML = `
    <p style="margin: 0;">
      We are
      <strong>${(confidence * 100).toFixed(2)}%</strong>
      confident this page contains AI-written content. You can choose to return or proceed anyway. Make sure to verify any important information.
    </p>
    <p style="margin: 0;">
      If you believe this detection is inaccurate, you can
      <strong>exclude</strong>
      this page or domain from future scans in the
      <strong>Extinction menu</strong>.
    </p>
  `;
  alertBox.appendChild(message);

  const buttonContainer: HTMLDivElement = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.flexWrap = "wrap";
  buttonContainer.style.gap = "16px";
  alertBox.appendChild(buttonContainer);

  const buttonStyles: string = `
    cursor: pointer;
    display: block;
    flex: 1;
    box-sizing: border-box;
    width: 100%;
    padding: 12px 48px;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    border: none;
    border-radius: 24px;
    transition: transform 0.1s ease;
  `;

  const press = (button: HTMLButtonElement) => {
    button.style.transform = "scale(0.9)";
  };

  const release = (button: HTMLButtonElement) => {
    button.style.transform = "scale(1)";
  };

  const proceedButton: HTMLButtonElement = document.createElement("button");
  proceedButton.textContent = "Proceed Anyway";
  proceedButton.style.cssText = `
    ${buttonStyles}
    background-color: #4d5c91;
    color: #aab9ed;
  `;
  proceedButton.addEventListener("pointerdown", () => press(proceedButton));
  proceedButton.addEventListener("pointerup", () => release(proceedButton));
  proceedButton.addEventListener("pointercancel", () => release(proceedButton));
  proceedButton.addEventListener("pointerleave", () => release(proceedButton));
  proceedButton.addEventListener("click", () => {
    document.body.style.overflow = originalBodyOverflow;
    background.style.opacity = "0";
    setTimeout(() => wrapper.remove(), 500);
  });
  buttonContainer.appendChild(proceedButton);

  const returnButton: HTMLButtonElement = document.createElement("button");
  returnButton.textContent = "Go Back";
  returnButton.style.cssText = `
    ${buttonStyles}
    background-color: #8997c4;
    color: #212b4f;
  `;
  returnButton.addEventListener("pointerdown", () => press(returnButton));
  returnButton.addEventListener("pointerup", () => release(returnButton));
  returnButton.addEventListener("pointercancel", () => release(returnButton));
  returnButton.addEventListener("pointerleave", () => release(returnButton));
  returnButton.addEventListener("click", () => window.history.back());
  buttonContainer.appendChild(returnButton);
}

function waitForDOMReady(): Promise<void> {
  return new Promise((resolve) => {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", () => resolve(), {
        once: true,
      });
    }
  });
}

let lastURL: string = location.href;
setInterval(() => {
  if (location.href !== lastURL) {
    lastURL = location.href;
    scanDocument();
  }
}, 500); // detect URL changes every 500 ms

waitForDOMReady().then(scanDocument);
