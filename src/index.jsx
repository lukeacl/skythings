/* @refresh reload */
import { Router, Route, Navigate, A } from "@solidjs/router";
import { render } from "solid-js/web";

import "./index.css";

import EmojiBubble from "./pages/EmojiBubble";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import BloomfieBubble from "./pages/BloomfieBubble";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

const Layout = (props) => {
  return (
    <div class="p-4 bg-sky-300 min-h-screen">
      <header class="flex justify-center mb-6">
        <A
          href="/"
          class="p-1 bg-sky-400 rounded mr-2 hover:opacity-80"
          activeClass="bg-sky-500 font-semibold"
          end
        >
          Home
        </A>
        <A
          href="/emoji-bubble"
          class="p-1 bg-sky-400 rounded mr-2 hover:opacity-80"
          activeClass="bg-sky-500 font-semibold"
        >
          Emoji Bubble
        </A>
        {false && (
          <A
            href="/bloomfie-bubble"
            class="p-1 bg-sky-400 rounded hover:opacity-80"
            activeClass="bg-sky-500 font-semibold"
          >
            Bloomfie Bubble
          </A>
        )}
      </header>

      <main class="flex flex-col items-center mb-6">{props.children}</main>

      <footer class="flex justify-center">
        <span class="text-sm font-thin">
          💕{" "}
          <a href="https://bsky.app/profile/lukeacl.com" target="_blank">
            @lukeacl.com
          </a>
        </span>
      </footer>
    </div>
  );
};

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route
        path="/emojis"
        component={() => <Navigate href={"/emoji-bubble"} />}
      />
      ;
      <Route path="/emoji-bubble" component={EmojiBubble} />
      <Route path="/bloomfie-bubble" component={BloomfieBubble} />
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  root,
);
