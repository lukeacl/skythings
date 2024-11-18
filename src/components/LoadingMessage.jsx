import "./LoadingMessage.css";

import { onMount, createSignal } from "solid-js";

import loadingMessages from "./LoadingMessage.data.json";

import spinner from "../icons/spinner-duotone-solid.svg";

function LoadingMessage(props) {
  const [loadingMessage, setLoadingMessage] = createSignal();

  const updateLoadingMessage = () => {
    setLoadingMessage(
      loadingMessages[Math.floor(Math.random() * loadingMessages.length)],
    );
  };

  onMount(() => {
    setInterval(updateLoadingMessage, 4000);
    updateLoadingMessage();
  });

  return (
    <>
      <p class="bg-pink-300 p-2 rounded text-sm flex flex-row">
        <img src={spinner} width="18" class="mr-2 loadingMessageSpinner" />
        {loadingMessage()}
      </p>
    </>
  );
}

export default LoadingMessage;
