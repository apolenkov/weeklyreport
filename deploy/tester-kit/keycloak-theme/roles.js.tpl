// Quick sign-in by role for the LOCAL tester stand only. setup.sh renders the
// passwords from secrets.env into this file; it is mounted into Keycloak as a
// ConfigMap theme, never committed with real values. Clicking a role fills the
// real Keycloak form and submits it, so the sign-in is the normal SAML flow.
(function () {
  var ROLES = [
    { label: "Lead", username: "lead1@customreport.local", password: "${PW_LEAD1}" },
    { label: "Head", username: "head@customreport.local", password: "${PW_HEAD}" },
    { label: "Viewer", username: "viewer@customreport.local", password: "${PW_VIEWER}" },
    { label: "Admin", username: "admin@customreport.local", password: "${PW_ADMIN}" },
  ];

  function setValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function init() {
    var form = document.getElementById("kc-form-login");
    var username = document.getElementById("username");
    var password = document.getElementById("password");
    var submit = document.getElementById("kc-login");
    if (!form || !username || !password || !submit) return;
    if (document.getElementById("wr-roles")) return;

    var box = document.createElement("div");
    box.id = "wr-roles";
    box.setAttribute("role", "group");
    box.setAttribute("aria-labelledby", "wr-roles-title");

    var title = document.createElement("p");
    title.id = "wr-roles-title";
    title.textContent = "Sign in as";
    box.appendChild(title);

    var row = document.createElement("div");
    row.className = "wr-roles-row";
    ROLES.forEach(function (role) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "wr-role-button";
      button.textContent = role.label;
      button.setAttribute("aria-label", "Role: " + role.label);
      button.addEventListener("click", function () {
        setValue(username, role.username);
        setValue(password, role.password);
        submit.click();
      });
      row.appendChild(button);
    });
    box.appendChild(row);
    form.parentNode.insertBefore(box, form);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
