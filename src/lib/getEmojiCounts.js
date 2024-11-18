import { iterateAtpRepo } from "@atcute/car";
import emojiRegex from "emoji-regex";

const regex = emojiRegex();

const getEmojiCounts = async (buffer, timePeriod = -1) => {
  let emojiCounts = {};

  let timeFrom = 0;
  if (timePeriod > -1) {
    timeFrom = Date.now() - timePeriod * 1000;
  }

  for (const { collection, rkey, record } of iterateAtpRepo(buffer)) {
    if (collection !== "app.bsky.feed.post") continue;
    if (new Date(record.createdAt).getTime() < timeFrom) continue;

    for (const match of (record.text || "").matchAll(regex)) {
      const emoji = match[0];
      if (!emojiCounts[emoji]) emojiCounts[emoji] = 0;
      emojiCounts[emoji]++;
    }
  }

  emojiCounts = Object.keys(emojiCounts).map((key) => ({
    emoji: key,
    count: emojiCounts[key],
  }));

  emojiCounts = emojiCounts.sort((a, b) => b.count - a.count);

  return emojiCounts;
};

export default getEmojiCounts;
