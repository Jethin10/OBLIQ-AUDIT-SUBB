/**
 * The reference theme's forms were driven by Contact Form 7. This shim keeps
 * the theme's own state machine - `init` shows the fields, anything else shows
 * the response block, `sent` prints it in black and `invalid` in red - and
 * posts to OBLIQ's endpoint instead.
 */
(function () {
  function output(form) {
    return form.querySelector(".wpcf7-response-output");
  }

  function state(form, name) {
    form.classList.remove("init", "submitting", "sent", "invalid");
    if (name) form.classList.add(name);
  }

  function says(form, text) {
    var target = output(form);
    if (target) target.textContent = text;
  }

  function flag(input, message) {
    input.classList.add("wpcf7-not-valid");
    input.setAttribute("aria-invalid", "true");
    var wrap = input.parentElement;
    if (!wrap || wrap.querySelector(".wpcf7-not-valid-tip")) return;
    var tip = document.createElement("span");
    tip.className = "wpcf7-not-valid-tip";
    tip.textContent = message;
    wrap.appendChild(tip);
  }

  function clearFlags(form) {
    form.querySelectorAll(".wpcf7-not-valid").forEach(function (input) {
      input.classList.remove("wpcf7-not-valid");
      input.setAttribute("aria-invalid", "false");
    });
    form.querySelectorAll(".wpcf7-not-valid-tip").forEach(function (tip) {
      tip.remove();
    });
  }

  function field(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function validate(form) {
    clearFlags(form);
    var email = field(form, "your-email");
    var name = field(form, "your-name");
    if (name && name.value.trim().length === 0) {
      flag(name, "Please add your name.");
      return false;
    }
    if (!email || email.value.trim().length === 0) {
      if (email) flag(email, "Please add an email address.");
      return false;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.value.trim())) {
      flag(email, "That email address looks incomplete.");
      return false;
    }
    return true;
  }

  document.querySelectorAll("form[data-obliq-form]").forEach(function (form) {
    var button = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (form.classList.contains("submitting")) return;
      if (!validate(form)) {
        says(form, "Please check the highlighted fields.");
        state(form, "invalid");
        return;
      }

      var email = field(form, "your-email");
      var name = field(form, "your-name");
      var textarea = field(form, "your-message");
      var payload = {
        email: email ? email.value.trim() : "",
        name: name ? name.value.trim() : undefined,
        message: textarea ? textarea.value.trim() : undefined,
      };

      state(form, "submitting");
      if (button) button.disabled = true;

      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response.json().then(function (body) {
            return { ok: response.ok, body: body };
          });
        })
        .then(function (result) {
          if (result.ok) {
            says(form, result.body.message || "Thank you.");
            state(form, "sent");
            return;
          }
          says(form, result.body.error || "Something went wrong. Please try again.");
          state(form, "invalid");
        })
        .catch(function () {
          says(form, "Network error - please try again.");
          state(form, "invalid");
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  });
})();