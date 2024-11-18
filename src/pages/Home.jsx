import { createSignal, createEffect, onMount, For } from "solid-js";

function Home() {
  const [data, setData] = createSignal({});

  const fetchData = async () => {
    setData({});
  };

  onMount(async () => {
    setInterval(async () => {
      await fetch();
    }, 60000);
    await fetchData();
  });

  return (
    <>
      <div>
        <p>
          Just a collection of things I've made for Bluesky and the AT Protocol.
        </p>
      </div>
    </>
  );
}

export default Home;
