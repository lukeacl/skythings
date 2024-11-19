import { AtpAgent } from "@atproto/api";

const getDID = async (handle) => {
  let did = handle.trim().toLowerCase();
  if (did.indexOf("did:plc:") !== 0) {
    const agent = new AtpAgent({ service: "https://public.api.bsky.app" });
    const response = await agent.resolveHandle({ handle: handle });
    if (response && response.data && response.data.did) did = response.data.did;
  }
  if (did.indexOf("did:plc:") !== 0) throw new Error("Could not resolve DID.");

  return did;
};

export default getDID;
