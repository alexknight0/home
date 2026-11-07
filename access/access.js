// Access page: lets Alex (the admin) see and edit who may use each site and who has which role
// (the lists in each project's config/access; see sites.js). Each project needs its own Google
// sign-in (one popup each, then remembered on this device).
import { ADMIN_EMAIL, SITES, appName } from "./sites.js";

const SDK = "https://www.gstatic.com/firebasejs/13.0.0/";
// Per site at runtime: auth, ref (config/access), ready (auth state known), user,
// data ({ field: [emails] } once loaded), error.

const $ = (id) => document.getElementById(id);
let fb = null;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

const isAdmin = (s) => s.user?.email?.toLowerCase() === ADMIN_EMAIL;
const canEdit = (s) => isAdmin(s) && s.data != null;
// Every (site, list) pair that can be edited right now.
const editableLists = () => SITES.filter(canEdit).flatMap((s) => s.lists.map((list) => ({ s, list })));
const listed = (s, list) => s.data[list.field];
// Pill text: the site's name for an allow list, "<site>: <role>" for a role.
const pillText = (s, list) => (list.allow ? s.name : `${s.short || s.name}: ${list.label}`);

async function loadFirebase() {
  const [app, auth, store] = await Promise.all([
    import(`${SDK}firebase-app.js`), import(`${SDK}firebase-auth.js`), import(`${SDK}firebase-firestore-lite.js`),
  ]);
  fb = { ...app, ...auth, ...store };
  for (const s of SITES) {
    const a = fb.initializeApp(s.config, appName(s));
    // localStorage, not Firebase's default IndexedDB: the sites share one origin and so one
    // sign-in database, and Firebase waits forever if another page blocks opening it.
    s.auth = fb.initializeAuth(a, { persistence: fb.browserLocalPersistence, popupRedirectResolver: fb.browserPopupRedirectResolver });
    s.ref = fb.doc(fb.getFirestore(a), "config", "access");
    fb.onAuthStateChanged(s.auth, (user) => {
      s.ready = true;
      s.user = user;
      s.data = null;
      s.error = null;
      render();
      if (isAdmin(s)) loadLists(s);
    });
  }
}

async function loadLists(s) {
  try {
    const snap = await fb.getDoc(s.ref);
    const doc = snap.exists() ? snap.data() : {};
    s.data = Object.fromEntries(s.lists.map((list) =>
      [list.field, Array.isArray(doc[list.field]) ? doc[list.field] : []]));
    s.error = null;
  } catch (err) {
    s.error = err.message;
  }
  render();
}

function signIn(s) {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
  fb.signInWithPopup(s.auth, provider).catch((err) => {
    if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      setMsg(`Sign-in to ${s.name} failed: ${err.message}`);
    }
  });
}

function setMsg(text) {
  $("access-msg").textContent = text;
}

// "Only you", "You and 2 others", "1 developer", plus the site's note.
function summary(s) {
  const parts = s.lists.map((list) => {
    const others = listed(s, list).filter((e) => e !== ADMIN_EMAIL).length;
    if (list.allow) return others ? `You and ${others} ${others === 1 ? "other" : "others"}` : "Only you";
    const n = listed(s, list).length;
    return n ? `${n} ${list.label.toLowerCase()}${n === 1 ? "" : "s"}` : `No ${list.label.toLowerCase()}s`;
  });
  return [...parts, s.note].filter(Boolean).join(" · ");
}

function siteRow(s) {
  let status;
  let action = null;
  if (!s.ready) {
    status = "Checking sign-in…";
  } else if (!s.user) {
    status = "Not signed in";
    action = el("button", { type: "button", className: "primary", textContent: "Sign in", onclick: () => signIn(s) });
  } else if (!isAdmin(s)) {
    status = `${s.user.email} can't manage access`;
    action = el("button", { type: "button", textContent: "Sign out", onclick: () => fb.signOut(s.auth) });
  } else if (s.error) {
    status = `Couldn't load: ${s.error}`;
  } else {
    status = s.data ? summary(s) : "Loading…";
  }
  return el("li", {},
    el("div", { className: "info" }, el("div", { className: "name", textContent: s.name }),
      el("div", { className: s.error ? "meta error" : "meta", textContent: status })),
    action);
}

function render() {
  $("access-sites").replaceChildren(...SITES.map(siteRow));

  const lists = editableLists();
  $("access-add").hidden = !lists.length;
  // Allow lists start ticked (the usual reason to add someone), roles unticked.
  const ticked = new Set([...$("access-checks").querySelectorAll("input")].map((c) => [c.value, c.checked]).filter(([, on]) => on).map(([v]) => v));
  const known = new Set([...$("access-checks").querySelectorAll("input")].map((c) => c.value));
  $("access-checks").replaceChildren(...lists.map(({ s, list }) => {
    const value = `${s.key}/${list.field}`;
    return el("label", {},
      el("input", { type: "checkbox", value, checked: known.has(value) ? ticked.has(value) : list.allow }),
      ` ${pillText(s, list)}`);
  }));

  const emails = [...new Set(lists.flatMap(({ s, list }) => listed(s, list)))].sort();
  $("access-people").replaceChildren(...emails.map((email) => el("li", {},
    el("div", { className: "info" }, el("div", { className: "name", textContent: email === ADMIN_EMAIL ? `${email} (you)` : email })),
    el("div", { className: "tags" }, ...lists.map(({ s, list }) => {
      const on = listed(s, list).includes(email);
      return el("button", {
        type: "button", className: "tag", textContent: pillText(s, list),
        title: on ? `Remove from ${pillText(s, list)}` : `Add to ${pillText(s, list)}`,
        ariaPressed: String(on), onclick: () => setListed(s, list, email, !on),
      });
    })))));
  $("access-people-section").hidden = !lists.length;
  $("access-none").hidden = emails.length > 0;
  $("signout-all").hidden = !SITES.some((s) => s.user);
}

function write(s, list, email, on) {
  return fb.setDoc(s.ref, { [list.field]: on ? fb.arrayUnion(email) : fb.arrayRemove(email) }, { merge: true });
}

async function setListed(s, list, email, on) {
  if (!on) {
    const what = list.allow ? `They won't be able to use ${s.name} any more.` : `They won't be a ${list.label.toLowerCase()} any more.`;
    if (!confirm(`Remove ${email} from ${pillText(s, list)}? ${what}`)) return;
  }
  try {
    await write(s, list, email, on);
    setMsg(on ? `Added ${email} to ${pillText(s, list)}.` : `Removed ${email} from ${pillText(s, list)}.`);
  } catch (err) {
    setMsg(`Couldn't change ${s.name}: ${err.message}`);
  }
  await loadLists(s);
}

async function addPerson(e) {
  e.preventDefault();
  const email = $("access-email").value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    setMsg("That doesn't look like an email address.");
    return;
  }
  const keys = new Set([...$("access-checks").querySelectorAll("input:checked")].map((c) => c.value));
  const chosen = editableLists().filter(({ s, list }) => keys.has(`${s.key}/${list.field}`));
  if (!chosen.length) {
    setMsg("Tick at least one site or role.");
    return;
  }
  const results = await Promise.allSettled(chosen.map(({ s, list }) => write(s, list, email, true)));
  const ok = chosen.filter((_, i) => results[i].status === "fulfilled");
  const lines = [];
  if (ok.length) {
    $("access-email").value = "";
    lines.push(`Added ${email} to ${ok.map(({ s, list }) => pillText(s, list)).join(", ")}.`);
    const links = [...new Set(ok.filter(({ s, list }) => list.allow && s.url).map(({ s }) => new URL(s.url, location.href).href))];
    if (links.length) lines.push(`Send them ${links.join("  ")}`);
  }
  chosen.forEach(({ s, list }, i) => {
    if (results[i].status === "rejected") lines.push(`Couldn't add to ${pillText(s, list)}: ${results[i].reason.message}`);
  });
  setMsg(lines.join("\n"));
  await Promise.all([...new Set(chosen.map(({ s }) => s))].map(loadLists));
}

$("access-add").onsubmit = addPerson;
$("signout-all").onclick = () => SITES.forEach((s) => s.user && fb.signOut(s.auth));
render();
loadFirebase().catch((err) => setMsg(`Couldn't load Firebase: ${err.message}`));
