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

function BloomfieBubble() {
  const [handle, setHandle] = createSignal("");
  const [handleGenerated, setHandleGenerated] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [percentLoaded, setPercentLoaded] = createSignal(0);
  const [image, setImage] = createSignal("");
  const [isChartVisible, setIsChartVisible] = createSignal(false);
  const [timePeriod, setTimePeriod] = createSignal(_SECONDS_ALL_TIME);
  const [size, setSize] = createSignal(2048);
  const [count, setCount] = createSignal(100);

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

      ctx.beginPath();
      ctx.arc(size() / 2, size() / 2, size() / 2 - padding, 0, 2 * Math.PI);
      ctx.fillStyle = "#eeeeee";
      ctx.fill();

      const avatarPromises = [];
      let avatarPromisesCompleted = 0;

      for (const [index, child] of (root.children || []).entries()) {
        ctx.beginPath();
        ctx.arc(child.x + padding, child.y + padding, child.r, 0, 2 * Math.PI);
        ctx.fillStyle = color(index) + "aa";
        ctx.fill();

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

      await Promise.all(avatarPromises);

      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          try {
            const blobUrl = URL.createObjectURL(blob);
            setImage(blobUrl);
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
      <p class="mb-2 font-semibold">Who do you interact with the most?</p>
      {image() && (
        <>
          <span
            id="chartWrapper"
            class="flex flex-col justify-center items-center bg-sky-300 mb-4"
          >
            <span id="chart" class="flex justify-center mb-2">
              <img src={image()} style="max-width: 50vw; height: auto;" />
            </span>
            <p class="text-xs font-light opacity-50 text-center">
              {getTimePeriodLabel(timePeriod())} #bloomfiebubble for @
              {handleGenerated()}
            </p>
            <p class="text-xs font-extralight opacity-40 text-center">
              Generate yours at
              <br />
              {window.location.href}
            </p>
          </span>
          {true && (
            <a
              href={image()}
              target="_blank"
              onClick={download}
              class="flex flex-row items-center text-sm bg-sky-200 p-2 rounded mb-6 hover:opacity-80"
            >
              <img src={downloadIcon} width="16" class="mr-2" /> Download
            </a>
          )}
        </>
      )}
      {isChartVisible() && (
        <>
          <span
            id="chartWrapper"
            class="flex flex-col justify-center items-center bg-sky-300 p-4"
          >
            <span id="chart" class="flex justify-center mb-2"></span>
            <p class="text-xs font-light opacity-50 text-center">
              {getTimePeriodLabel(timePeriod())} #bloomfiebubble for @
              {handleGenerated()}
            </p>
            <p class="text-xs font-extralight opacity-40 text-center">
              Generate yours at
              <br />
              {window.location.href}
            </p>
          </span>
          {true && (
            <a
              href={image()}
              target="_blank"
              onClick={download}
              class="flex flex-row items-center text-sm bg-sky-200 p-2 rounded mb-6 hover:opacity-80"
            >
              <img src={downloadIcon} width="16" class="mr-2" /> Download
            </a>
          )}
        </>
      )}
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
          Generate{isLoading() ? ` (${percentLoaded()}%)` : ""}
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

export default BloomfieBubble;
