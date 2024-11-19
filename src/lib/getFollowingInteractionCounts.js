import { iterateAtpRepo } from "@atcute/car";
import emojiRegex from "emoji-regex";

const regex = emojiRegex();

const getFollowingInteractionCounts = async (buffer, timePeriod = -1) => {
  let followingInteractionCounts = {};

  let timeFrom = 0;
  if (timePeriod > -1) {
    timeFrom = Date.now() - timePeriod * 1000;
  }

  for (const { collection, rkey, record } of iterateAtpRepo(buffer)) {
    if (
      [
        "app.bsky.feed.post",
        "app.bsky.feed.repost",
        "app.bsky.feed.like",
        "app.bsky.graph.follow",
      ].includes(collection) === false
    )
      continue;
    if (new Date(record.createdAt).getTime() < timeFrom) continue;

    if (collection === "app.bsky.feed.post") {
      if (record.reply) {
        const [, , did] = record.reply.parent.uri.split("/");
        if (!followingInteractionCounts[did])
          followingInteractionCounts[did] = 0;
        followingInteractionCounts[did]++;
      }
    }

    if (collection === "app.bsky.feed.repost") {
      const [, , did] = record.subject.uri.split("/");
      if (!followingInteractionCounts[did]) followingInteractionCounts[did] = 0;
      followingInteractionCounts[did]++;
    }

    if (collection === "app.bsky.feed.like") {
      const [, , did] = record.subject.uri.split("/");
      if (!followingInteractionCounts[did]) followingInteractionCounts[did] = 0;
      followingInteractionCounts[did]++;
    }

    if (collection === "app.bsky.graph.follow") {
      const did = record.subject;
      if (!followingInteractionCounts[did]) followingInteractionCounts[did] = 0;
      followingInteractionCounts[did]++;
    }
  }

  followingInteractionCounts = Object.keys(followingInteractionCounts).map(
    (key) => ({
      did: key,
      count: followingInteractionCounts[key],
    }),
  );

  followingInteractionCounts = followingInteractionCounts.sort(
    (a, b) => b.count - a.count,
  );

  return followingInteractionCounts;
};

export default getFollowingInteractionCounts;
