// "Manage access": lets Alex (the admin) edit the allow lists of the sites that have one.
// Each site has its own Firebase project, and its firestore.rules only let the admin read or write
// config/access = { emails: [lower-case] }. Each project needs its own Google sign-in (one popup
// each, then remembered on this device). Firebase is only loaded once the dialog is opened, so
// the launcher itself stays fast.
const SDK = "https://www.gstatic.com/firebasejs/13.0.0/";
const ADMIN_EMAIL = "octopus0246@gmail.com"; // also hard-coded in each site's firestore.rules

// Public web-app configs (not secrets; access is controlled by each project's firestore.rules).
const SITES = [
  {
    key: "filedrop",
    name: "File drop",
    url: "../filedrop/",
    config: {
      apiKey: "AIzaSyDGAvIT1TFSyATymfE8IJt2PY7mOEhUCgQ",
      authDomain: "filedrop-da70b0.firebaseapp.com",
      projectId: "filedrop-da70b0",
      appId: "1:463136665514:web:55272c1996c2d285edc5d3",
    },
  },
  {
    key: "podcast-player",
    name: "Podcast Player",
    url: "../podcast-player/",
    config: {
      apiKey: "AIzaSyB8frzocd36VJ8Uw369qMv9qJRFns0sGYM",
      authDomain: "handa-player-553cb2.firebaseapp.com",
      projectId: "handa-player-553cb2",
      appId: "1:408789063169:web:c73089280248a46e7a5200",
    },
  },
];
// Per site at runtime: auth, ref (config/access), ready (auth state known), user,
// emails (array once loaded), error.

const $ = (id) => document.getElementById(id);
let fb = null;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

const isAdmin = (s) => s.user?.email?.toLowerCase() === ADMIN_EMAIL;
const canEdit = (s) => isAdmin(s) && Array.isArray(s.emails);

async function loadFirebase() {
  if (fb) return;
  const [app, auth, store] = await Promise.all([
    import(`${SDK}firebase-app.js`), import(`${SDK}firebase-auth.js`), import(`${SDK}firebase-firestore-lite.js`),
  ]);
  fb = { ...app, ...auth, ...store };
  for (const s of SITES) {
    // Named apps, so each project keeps its own sign-in (the sites themselves use "[DEFAULT]").
    const a = fb.initializeApp(s.config, `home-${s.key}`);
    s.auth = fb.getAuth(a);
    s.ref = fb.doc(fb.getFirestore(a), "config", "access");
    fb.onAuthStateChanged(s.auth, (user) => {
      s.ready = true;
      s.user = user;
      s.emails = null;
      s.error = null;
      render();
      if (isAdmin(s)) loadEmails(s);
    });
  }
}

async function loadEmails(s) {
  try {
    const snap = await fb.getDoc(s.ref);
    s.emails = (snap.exists() ? snap.get("emails") : null) ?? [];
  } catch (err) {
    s.error = err.message;
  }
  render();
}

function signIn(s) {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
  fb.signInWithPopup(s.auth, provider).catch((err) => setMsg(`Sign-in to ${s.name} failed: ${err.message}`));
}

function setMsg(text) {
  $("access-msg").textContent = text;
}

function render() {
  if (!SITES.every((s) => s.ready)) return;
  $("access-loading").hidden = true;

  $("access-sites").replaceChildren(...SITES.map((s) => {
    let status;
    let action = null;
    if (!s.user) {
      status = "Not signed in";
      action = el("button", { type: "button", className: "primary", textContent: "Sign in", onclick: () => signIn(s) });
    } else if (!isAdmin(s)) {
      status = `${s.user.email} can't manage access`;
      action = el("button", { type: "button", textContent: "Sign out", onclick: () => fb.signOut(s.auth) });
    } else if (s.error) {
      status = `Couldn't load: ${s.error}`;
    } else {
      status = s.emails ? `${s.emails.length} approved` : "Loading…";
    }
    return el("li", {},
      el("div", { className: "info" }, el("div", { className: "name", textContent: s.name }),
        el("div", { className: s.error ? "meta error" : "meta", textContent: status })),
      action);
  }));

  const editable = SITES.filter(canEdit);
  $("access-form").hidden = !editable.length;
  $("access-checks").replaceChildren(...editable.map((s) => el("label", {},
    el("input", { type: "checkbox", checked: true, value: s.key }), ` ${s.name}`)));

  const emails = [...new Set(editable.flatMap((s) => s.emails))].sort();
  $("access-people").replaceChildren(...emails.map((email) => el("li", {},
    el("div", { className: "info" }, el("div", { className: "name", textContent: email })),
    el("div", { className: "tags" }, ...editable.map((s) => {
      const on = s.emails.includes(email);
      return el("button", {
        type: "button", className: "tag", textContent: s.name,
        title: on ? `Remove from ${s.name}` : `Approve for ${s.name}`,
        ariaPressed: String(on), onclick: () => setApproved(s, email, !on),
      });
    })))));
  $("access-none").hidden = !editable.length || emails.length > 0;
  $("signout-all").hidden = !SITES.some((s) => s.user);
}

async function setApproved(s, email, on) {
  if (!on && !confirm(`Remove ${email} from ${s.name}? They won't be able to use it any more.`)) return;
  try {
    await fb.setDoc(s.ref, { emails: on ? fb.arrayUnion(email) : fb.arrayRemove(email) }, { merge: true });
    setMsg(on ? `Approved ${email} for ${s.name}.` : `Removed ${email} from ${s.name}.`);
  } catch (err) {
    setMsg(`Couldn't change ${s.name}: ${err.message}`);
  }
  await loadEmails(s);
}

async function addPerson(e) {
  e.preventDefault();
  const email = $("access-email").value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    setMsg("That doesn't look like an email address.");
    return;
  }
  const keys = [...$("access-checks").querySelectorAll("input:checked")].map((c) => c.value);
  const chosen = SITES.filter((s) => keys.includes(s.key) && canEdit(s));
  if (!chosen.length) {
    setMsg("Tick at least one site.");
    return;
  }
  const results = await Promise.allSettled(chosen.map((s) =>
    fb.setDoc(s.ref, { emails: fb.arrayUnion(email) }, { merge: true })));
  const ok = chosen.filter((_, i) => results[i].status === "fulfilled");
  const failed = chosen.filter((_, i) => results[i].status === "rejected");
  const lines = [];
  if (ok.length) {
    $("access-email").value = "";
    lines.push(`Approved ${email} for ${ok.map((s) => s.name).join(" and ")}. Send them ${ok.map((s) =>
      new URL(s.url, location.href).href).join(" and ")}`);
  }
  for (const s of failed) lines.push(`Couldn't add to ${s.name}: ${results[chosen.indexOf(s)].reason.message}`);
  setMsg(lines.join("\n"));
  await Promise.all(chosen.map(loadEmails));
}

$("access-open").onclick = async () => {
  setMsg("");
  $("access-dialog").showModal();
  try {
    await loadFirebase();
  } catch (err) {
    $("access-loading").textContent = `Couldn't load Firebase: ${err.message}`;
  }
};
$("access-form").onsubmit = addPerson;
$("signout-all").onclick = () => SITES.forEach((s) => s.user && fb.signOut(s.auth));
