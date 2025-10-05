import { AtpAgent } from "@atproto/api";
import * as d3 from "d3";
import domtoimage from "dom-to-image";
import * as htmlToImage from "html-to-image";
import { saveAs } from "file-saver";
import { createSignal, createEffect, onMount, For } from "solid-js";
import Swal from "sweetalert2";

import LoadingMessage from "../components/LoadingMessage";

import getDID from "../lib/getDID";
import getFollowingInteractionCounts from "../lib/getFollowingInteractionCounts";
import getRepoBuffer from "../lib/getRepoBuffer";

import downloadIcon from "../icons/download-duotone-solid.svg";
import copyIcon from "../icons/copy-duotone-solid.svg";

import bubbleImage from "../images/bubble.png";

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

const showInfo = (title, message) => {
  Swal.fire({
    icon: "info",
    title: title,
    text: message,
  });
};

function BloomfieBubble() {
  const [handle, setHandle] = createSignal("");
  const [handleGenerated, setHandleGenerated] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [percentLoaded, setPercentLoaded] = createSignal(0);
  const [image, setImage] = createSignal("");
  const [isChartVisible, setIsChartVisible] = createSignal(false);
  const [timePeriod, setTimePeriod] = createSignal(_SECONDS_ONE_MONTH);
  const [size, setSize] = createSignal(2048);
  const [count, setCount] = createSignal(100);
  const [altText, setAltText] = createSignal("");

  const generate = async () => {
    if (handle().trim() === "")
      return showError("Please enter your Bluesky handle.");

    if (handle().indexOf(".") === -1) {
      setHandle(`${handle()}.bsky.social`);
    }

    setImage("");
    setIsChartVisible(false);
    setIsLoading(true);
    setPercentLoaded(0);
    try {
      const publicAgent = new AtpAgent({
        service: "https://public.api.bsky.app",
      });

      const did = await getDID(handle());
      const buffer = await getRepoBuffer(did);

      let followingInteractionCounts = (
        await getFollowingInteractionCounts(buffer, timePeriod())
      )
        .filter((item) => item.did !== did)
        .slice(0, count() - 1);

      const maxCount = followingInteractionCounts.reduce(
        (prev, curr) => Math.max(prev, curr.count),
        1,
      );

      followingInteractionCounts.push({
        did: did,
        count: Math.floor(Math.max(maxCount * 1.25, 5)),
      });
      followingInteractionCounts = followingInteractionCounts.sort(
        (a, b) => b.count - a.count,
      );

      const chunkSize = 25;
      for (let i = 0; i < followingInteractionCounts.length; i += chunkSize) {
        const chunk = followingInteractionCounts
          .slice(i, i + chunkSize)
          .map((item) => item.did);
        const profiles = await publicAgent.getProfiles({ actors: chunk });
        for (const profile of profiles.data.profiles) {
          const index = followingInteractionCounts.findIndex(
            (f) => f.did === profile.did,
          );
          followingInteractionCounts[index].handle = profile.handle;
          if (profile.avatar) {
            followingInteractionCounts[index].avatar = profile.avatar;
          }
        }
      }

      const padding = 80;
      const interCirclePadding = 4;

      var color = d3.scaleOrdinal(d3.schemeCategory10);
      const pack = d3
        .pack()
        .size([size() - padding * 2, size() - padding * 2])
        .padding(interCirclePadding);
      const root = pack(
        d3
          .hierarchy({ children: followingInteractionCounts })
          .sum((d) => d.count),
      );

      const canvas = document.createElement("canvas");
      canvas.width = size();
      canvas.height = size();

      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#7dd3fc";
      ctx.fillRect(0, 0, size(), size());

      /*ctx.beginPath();
      ctx.arc(size() / 2, size() / 2, size() / 2 - padding, 0, 2 * Math.PI);
      ctx.fillStyle = "#eeeeee";
      ctx.fill();*/

      const avatarPromises = [];
      let avatarPromisesCompleted = 0;

      let newAltText = `A bubble on a blue background containing a circular avatar of @${handle()} in the middle, then arranged around @${handle()} more circular avatars of people @${handle()} interacts with the most. The size of the circlular avatars are getting smaller as you move around and outwards representing less and less interaction. Avatars in order from most interaction to least interaction include `;
      let altTextFooter = `. A credit at the bottom right reads ${handle()} #BloomfieBubble skythings.lukeacl.com.`;

      for (const [index, child] of (root.children || []).entries()) {
        ctx.beginPath();
        ctx.arc(child.x + padding, child.y + padding, child.r, 0, 2 * Math.PI);
        ctx.fillStyle = color(index) + "aa";
        ctx.fill();

        let altTextAddition = `${index === 0 ? `@${child.data.handle}` : `, @${child.data.handle}`}`;
        if (`${newAltText}${altTextAddition}${altTextFooter}`.length <= 2000) {
          newAltText = `${newAltText}${altTextAddition}`;
        }

        if (child.data.avatar) {
          try {
            avatarPromises.push(
              new Promise(async (resolve) => {
                const [, , , , , , did, cid] = child.data.avatar
                  .split("@")[0]
                  .split("/");
                const url = `https://api.lukeacl.com/at/blob/${did}/${cid}`;
                const response = await fetch(url);
                const blob = await response.blob();
                const objectURL = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(
                    child.x + padding,
                    child.y + padding,
                    child.r,
                    0,
                    Math.PI * 2,
                  );
                  ctx.closePath();
                  ctx.clip();
                  ctx.drawImage(
                    img,
                    child.x + padding - child.r,
                    child.y + padding - child.r,
                    child.r * 2,
                    child.r * 2,
                  );
                  ctx.restore();
                  URL.revokeObjectURL(objectURL);
                  resolve();
                };
                img.onerror = () => {
                  URL.revokeObjectURL(objectURL);
                  resolve();
                };
                img.src = objectURL;
              }).then(() => {
                avatarPromisesCompleted++;
                setPercentLoaded(
                  Math.floor(
                    (avatarPromisesCompleted / (root.children || []).length) *
                      100,
                  ),
                );
              }),
            );
          } catch (error) {
            console.log(error);
          }
        }
      }

      newAltText = `${newAltText}${altTextFooter}`;

      setAltText(newAltText.slice(0, 2000));

      await Promise.all(avatarPromises);

      await new Promise(async (resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(
            img,
            padding / 2,
            padding / 2,
            size() - padding,
            size() - padding,
          );
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
        img.src = bubbleImage;
      });

      const creditURLText = "skythings.lukeacl.com";
      ctx.font = `${Math.floor(size() / 60)}px sans-serif`;
      ctx.fillStyle = "#ffffff99";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const creditURLTextMetrics = ctx.measureText(creditURLText);
      ctx.fillText(
        creditURLText,
        size() - creditURLTextMetrics.width - padding / 2,
        size() - creditURLTextMetrics.actualBoundingBoxAscent - padding / 2,
      );

      const titleText = `#BloomfieBubble`;
      ctx.font = `bold ${Math.floor(size() / 60)}px sans-serif`;
      ctx.fillStyle = "#ffffff99";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const titleTextMetrics = ctx.measureText(titleText);
      ctx.fillText(
        titleText,
        size() - titleTextMetrics.width - padding / 2,
        size() -
          creditURLTextMetrics.actualBoundingBoxAscent -
          2 -
          titleTextMetrics.actualBoundingBoxAscent -
          padding / 2,
      );

      const timePeriodText = `${getTimePeriodLabel(timePeriod())}`;
      ctx.font = `${Math.floor(size() / 60)}px sans-serif`;
      ctx.fillStyle = "#ffffff99";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const timePeriodTextMetrics = ctx.measureText(timePeriodText);
      ctx.fillText(
        timePeriodText,
        size() - timePeriodTextMetrics.width - padding / 2,
        size() -
          titleTextMetrics.actualBoundingBoxAscent -
          2 -
          creditURLTextMetrics.actualBoundingBoxAscent -
          2 -
          timePeriodTextMetrics.actualBoundingBoxAscent -
          padding / 2,
      );

      const handleText = `@${handle()}`;
      ctx.font = `${Math.floor(size() / 60)}px sans-serif`;
      ctx.fillStyle = "#ffffff99";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const handleTextMetrics = ctx.measureText(handleText);
      ctx.fillText(
        handleText,
        size() - handleTextMetrics.width - padding / 2,
        size() -
          timePeriodTextMetrics.actualBoundingBoxAscent -
          2 -
          titleTextMetrics.actualBoundingBoxAscent -
          2 -
          creditURLTextMetrics.actualBoundingBoxAscent -
          2 -
          handleTextMetrics.actualBoundingBoxAscent -
          padding / 2,
      );

      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          try {
            const blobURL = URL.createObjectURL(blob);
            setImage(blobURL);
            setHandleGenerated(handle());
          } catch (error) {
          } finally {
            resolve();
          }
        });
      });
    } catch (error) {
      console.log(error);
      showError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyAltText = async () => {
    navigator.clipboard.writeText(altText());
    showInfo(
      "Copied!",
      "The alt text for this Bloomfie Bubble has been copied to your clipboard.",
    );
  };

  const download = async () => {
    window.location.href = image();
  };

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
      <p class="font-semibold mb-2">Who do you interact with the most?</p>
      {image() && (
        <>
          <span
            id="chartWrapper"
            class="flex flex-col justify-center items-center bg-sky-300 mb-2"
          >
            <span id="chart" class="flex justify-center">
              <img src={image()} style="max-width: 50vw; height: auto;" />
            </span>
          </span>
          <span class="flex flex-row">
            <a
              download={"bloomfiebubble.png"}
              href={image()}
              target="_blank"
              onClick={download}
              class="flex flex-row items-center text-sm bg-sky-200 p-2 rounded mb-6 hover:opacity-80 mr-2"
            >
              <img src={downloadIcon} width="16" class="mr-2" /> Download
            </a>
            <button
              onClick={copyAltText}
              class="flex flex-row items-center text-sm bg-sky-200 p-2 rounded mb-6 hover:opacity-80"
            >
              <img src={copyIcon} width="16" class="mr-2" /> Copy Alt Text
            </button>
          </span>
        </>
      )}
      {isLoading() && (
        <span class="mb-2">
          <LoadingMessage />
        </span>
      )}
      <span class="mt-2 mb-2">
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
          {isLoading() && percentLoaded() > 0 ? ` (${percentLoaded()}%)` : ""}
        </button>
      </span>
      <span class="">
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

export default BloomfieBubble;
