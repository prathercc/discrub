/**
 * Firefox Classic shim
 *
 * Copied into classic/ during Firefox extension builds by build-extension.js.
 * Handles token injection, close detection when Classic is loaded directly
 * in the overlay iframe (no classic-wrapper.html) on Firefox.
 *
 * Must be an external script (not inline) because Classic's CSP blocks
 * inline scripts but allows 'self' scripts from the same extension origin.
 */

// Token receiver + close watcher
(function () {
  var TOKEN_INJECT_TIMEOUT = 15000;
  var TOKEN_POLL_INTERVAL = 300;
  var injected = false;

  console.log("[Classic Firefox] Shim loaded, listening for token");

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "discrub:token") return;
    var token = event.data.token;
    console.log("[Classic Firefox] Token received:", token ? "yes" : "empty");
    if (!token || injected) return;

    var startTime = Date.now();
    var poll = setInterval(function () {
      if (injected) {
        clearInterval(poll);
        return;
      }
      var input = document.querySelector(
        "input[type=password], input[type=text]"
      );
      var submitBtn = document.querySelector("button[type=submit], button");

      if (input && submitBtn) {
        clearInterval(poll);
        injected = true;
        console.log("[Classic Firefox] Found auth form, injecting token");
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;
        nativeInputValueSetter.call(input, token);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        setTimeout(function () {
          var buttons = document.querySelectorAll("button");
          for (var i = 0; i < buttons.length; i++) {
            var text = (buttons[i].textContent || "").toLowerCase().trim();
            if (
              text.indexOf("sign") !== -1 ||
              text.indexOf("submit") !== -1 ||
              text.indexOf("login") !== -1 ||
              text.indexOf("authenticate") !== -1
            ) {
              console.log("[Classic Firefox] Clicking submit button");
              buttons[i].click();
              break;
            }
          }
        }, 200);
      }

      if (Date.now() - startTime > TOKEN_INJECT_TIMEOUT) {
        clearInterval(poll);
        console.warn("[Classic Firefox] Token injection timed out");
      }
    }, TOKEN_POLL_INTERVAL);
  });

  // Close watcher: detect when Classic UI is closed and notify parent
  setInterval(function () {
    var root = document.getElementById("root");
    if (root && root.children.length > 0) {
      var content = root.innerHTML.trim();
      if (content === "" || content === "<!-- -->") {
        window.parent.postMessage(
          { type: "discrub:switchVersion", version: "launcher" },
          "*"
        );
      }
    }
  }, 1000);
})();
