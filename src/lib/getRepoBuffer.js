import { AtpAgent } from "@atproto/api";

const getRepoBuffer = async (did) => {
  let pds = undefined;
  const service = (
    await (await fetch(`https://plc.directory/${did}`)).json()
  ).service.find((service) => service.id === "#atproto_pds");
  if (service && service.serviceEndpoint) pds = service.serviceEndpoint;
  if (pds === undefined) throw new Error("Could not resolve PDS.");

  const response = await fetch(
    `${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`,
  );

  const buffer = await response.arrayBuffer();

  console.log(did, pds, buffer.byteLength);

  return buffer;
};

export default getRepoBuffer;
