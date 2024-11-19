import * as d3 from "d3";
import domtoimage from "dom-to-image";
import { saveAs } from "file-saver";
import { createSignal, createEffect, onMount, For } from "solid-js";
import Swal from "sweetalert2";

import LoadingMessage from "../components/LoadingMessage";

import getEmojiCounts from "../lib/getEmojiCounts";
import getRepoBuffer from "../lib/getRepoBuffer";

import downloadIcon from "../icons/download-duotone-solid.svg";

const _SECONDS_ALL_TIME = -1;
const _SECONDS_ONE_DAY = 86400;
const _SECONDS_ONE_WEEK = _SECONDS_ONE_DAY * 7;
const _SECONDS_ONE_MONTH = _SECONDS_ONE_WEEK * 28;

const showError = (message) => {
  Swal.fire({
    icon: "error",
    title: "Error!",
    text: message,
  });
};

function EmojiBubble() {
  const [handle, setHandle] = createSignal("");
  const [handleGenerated, setHandleGenerated] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [isChartVisible, setIsChartVisible] = createSignal(false);
  const [isChartImageVisible, setIsChartImageVisible] = createSignal(false);
  const [chartData, setChartData] = createSignal("");
  const [timePeriod, setTimePeriod] = createSignal(_SECONDS_ALL_TIME);

  const generate = async () => {
    if (handle().trim() === "")
      return showError("Please enter your Bluesky handle.");

    if (handle().indexOf(".") === -1) {
      setHandle(`${handle()}.bsky.social`);
    }

    setIsChartVisible(false);
    setIsChartImageVisible(false);
    setIsLoading(true);
    try {
      const buffer = await getRepoBuffer(handle());
      const emojiCounts = await getEmojiCounts(buffer, timePeriod());

      if (emojiCounts.length === 0)
        throw new Error(
          "It doesn't look like you've used any emoji yet! There's nothing to generate.",
        );

      const dataset = { children: emojiCounts };

      var diameter = Math.min(window.innerWidth, window.innerHeight) * 0.75;
      var color = d3.scaleOrdinal(d3.schemeCategory10);

      const pack = d3.pack().size([diameter, diameter]).padding(1.5);

      const root = pack(
        d3.hierarchy({ children: emojiCounts }).sum((d) => d.count),
      );

      const svg = d3
        .create("svg")
        .attr("width", diameter)
        .attr("height", diameter)
        .attr("viewBox", [0, 0, diameter, diameter])
        .attr(
          "style",
          "max-width: 75%; height: auto; font: 10px sans-serif; background-color: #eeeeee; padding: 10px; border-radius: 50%;",
        )
        .attr("text-anchor", "middle");

      const node = svg
        .append("g")
        .selectAll()
        .data(root.leaves())
        .join("g")
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

      node
        .append("circle")
        .attr("fill-opacity", 0.7)
        .attr("fill", (d, i) => color(i))
        .attr("r", (d) => d.r);

      const text = node
        .append("text")
        .text(function (d) {
          return d.data.emoji;
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", function (d) {
          return d.r * 1.25;
        })
        .style("alignment-baseline", "central")
        .attr("clip-path", (d) => `circle(${d.r})`);

      const data = Object.assign(svg.node(), { scales: { color } });

      setIsChartVisible(true);
      document.getElementById("chart").innerHTML = "";
      document.getElementById("chart").append(data);

      setHandleGenerated(handle());

      /*const chart = document.getElementById("chartWrapper");
      const png = await domtoimage.toPng(chart, {
        width: chart.clientWidth * 2,
        height: chart.clientHeight * 2,
        style: {
          transform: "scale(" + 2 + ")",
          transformOrigin: "top left",
        },
      });
      setChartData(png);*/

      //setIsChartVisible(false);
      //setIsChartImageVisible(true);
    } catch (error) {
      console.log(error);
      showError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const download = async () => {
    /*const chart = document.getElementById("chartWrapper");
    const png = await domtoimage.toPng(chart);
    const link = document.createElement("a");
    link.download = "emoji-bubble";
    link.href = png;
    link.click();*/
    domtoimage
      .toBlob(document.getElementById("chartWrapper"))
      .then(function (blob) {
        saveAs(blob, "emoji-bubble.png");
      });
  };

  /*href={chartData()}
  download="emoji-bubble.png"*/

  const getTimePeriodLabel = (timePeriodData) => {
    switch (timePeriodData) {
      case _SECONDS_ALL_TIME:
        return "All Time";
      case _SECONDS_ONE_DAY:
        return "Last Day";
      case _SECONDS_ONE_WEEK:
        return "Last Week";
      case _SECONDS_ONE_MONTH:
        return "Last Month";
      default:
        return "";
    }
  };

  const updateTimePeriod = (newTimePeriod) => {
    setTimePeriod(newTimePeriod);
    setIsChartVisible(false);
  };

  return (
    <>
      {isChartVisible() && (
        <>
          <span
            id="chartWrapper"
            class="flex flex-col justify-center items-center bg-sky-300 p-4"
          >
            <span id="chart" class="flex justify-center mb-2"></span>
            <p class="text-xs font-light opacity-50 text-center">
              {getTimePeriodLabel(timePeriod())} #emojibubble for @
              {handleGenerated()}
            </p>
            <p class="text-xs font-extralight opacity-40 text-center">
              Generate yours at
              <br />
              {window.location.href}
            </p>
          </span>
          {true && (
            <button
              onClick={download}
              class="flex flex-row items-center text-sm bg-sky-200 p-2 rounded mb-6 hover:opacity-80"
            >
              <img src={downloadIcon} width="16" class="mr-2" /> Download
            </button>
          )}
        </>
      )}
      {isChartImageVisible() && <img src={chartData()} />}
      {isLoading() && (
        <span class="mb-2">
          <LoadingMessage />
        </span>
      )}
      <span>
        <input
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          disabled={isLoading()}
          value={handle()}
          onInput={(event) =>
            setHandle((event.target.value || "").trim().toLowerCase())
          }
          onKeyPress={(event) => {
            if (event.code === "Enter") {
              event.target.blur();
              generate();
            }
          }}
          class="bg-white p-2 rounded-s disabled:opacity-50 outline-none"
          placeholder="handle.bsky.social"
        />
        <button
          disabled={handle().trim() === "" || isLoading()}
          onClick={generate}
          class="bg-gray-500 text-white p-2 rounded-e disabled:opacity-50 hover:opacity-80"
        >
          Generate
        </button>
      </span>
      <span class="mt-2">
        <button
          class={
            "p-1 rounded text-xs mr-2 " +
            (timePeriod() === _SECONDS_ALL_TIME
              ? "bg-sky-100 font-semibold"
              : "bg-sky-200")
          }
          onClick={() => updateTimePeriod(_SECONDS_ALL_TIME)}
        >
          All Time
        </button>
        <button
          class={
            "p-1 rounded text-xs mr-2 " +
            (timePeriod() === _SECONDS_ONE_WEEK
              ? "bg-sky-100 font-semibold"
              : "bg-sky-200")
          }
          onClick={() => updateTimePeriod(_SECONDS_ONE_WEEK)}
        >
          Last Week
        </button>
        <button
          class={
            "p-1 rounded text-xs " +
            (timePeriod() === _SECONDS_ONE_MONTH
              ? "bg-sky-100 font-semibold"
              : "bg-sky-200")
          }
          onClick={() => updateTimePeriod(_SECONDS_ONE_MONTH)}
        >
          Last Month
        </button>
      </span>
    </>
  );
}

export default EmojiBubble;
