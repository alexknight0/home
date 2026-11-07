// The sites (Firebase projects) whose access the Access page manages, shared with the home
// page's tile check. Every project keeps its access lists in one Firestore doc,
// config/access = { <field>: [lower-case emails], ... }, which only the admin may write (each
// project's firestore.rules hard-codes ADMIN_EMAIL). A list either says who may use the site at
// all (`allow: true`; the admin is always allowed whether listed or not) or gives a role on a
// site anyone may use (`allow` false, e.g. Smarter Subtitles' developers; nobody has a role
// unless listed, the admin included).
export const ADMIN_EMAIL = "octopus0246@gmail.com";

// Public web-app configs (not secrets; access is controlled by each project's firestore.rules).
export const SITES = [
  {
    key: "filedrop",
    name: "File drop",
    url: "../../filedrop/",
    lists: [{ field: "emails", label: "Allowed", allow: true }],
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
    url: "../../podcast-player/",
    lists: [{ field: "emails", label: "Allowed", allow: true }],
    config: {
      apiKey: "AIzaSyB8frzocd36VJ8Uw369qMv9qJRFns0sGYM",
      authDomain: "handa-player-553cb2.firebaseapp.com",
      projectId: "handa-player-553cb2",
      appId: "1:408789063169:web:c73089280248a46e7a5200",
    },
  },
  {
    key: "lecture-player",
    name: "Lectures",
    url: "../../lecture-player/",
    lists: [{ field: "emails", label: "Allowed", allow: true }],
    config: {
      apiKey: "AIzaSyDgEbqEwI9KHnFlBLRJ8RQIgdntISQPty0",
      authDomain: "lecture-player-d77815.firebaseapp.com",
      projectId: "lecture-player-d77815",
      appId: "1:905522641482:web:f737cbe4b19eeead1a04b3",
    },
  },
  {
    key: "notes",
    name: "Notes",
    url: "../../notes/",
    note: "Each person has their own notes.",
    lists: [{ field: "emails", label: "Allowed", allow: true }],
    config: {
      apiKey: "AIzaSyBf8KKXDVMi-iIbRfI64NgUtK1kM0QdmSw",
      authDomain: "notes-e2b6c3.firebaseapp.com",
      projectId: "notes-e2b6c3",
      appId: "1:901046426288:web:a4206278ac235fcb74b975",
    },
  },
  {
    key: "one-video",
    name: "One Video",
    url: "../../one-video/",
    note: "Others can watch; only you can change the video.",
    // Shares the Lectures project, so it has its own list in that project's config/access.
    lists: [{ field: "oneVideo", label: "Can watch", allow: true }],
    // The site signs in with a named app, not "[DEFAULT]" (that one is the Lectures sign-in).
    siteApp: "one-video",
    config: {
      apiKey: "AIzaSyDgEbqEwI9KHnFlBLRJ8RQIgdntISQPty0",
      authDomain: "lecture-player-d77815.firebaseapp.com",
      projectId: "lecture-player-d77815",
      appId: "1:905522641482:web:f737cbe4b19eeead1a04b3",
    },
  },
  {
    key: "dual-subs",
    name: "Smarter Subtitles",
    short: "Subs",
    // A Chrome extension, so there's no link to send; anyone may sign in to it.
    note: "Anyone with a Google account can use it.",
    lists: [{ field: "developers", label: "Developer", allow: false }],
    config: {
      apiKey: "AIzaSyAwUezOndGsztkWGH00Z-PqNRUnyZHouHU",
      authDomain: "dual-subs-2b0407.firebaseapp.com",
      projectId: "dual-subs-2b0407",
      appId: "1:729739067887:web:134e9a9668a73c6b69f61a",
    },
  },
];

// Named Firebase app used by the Access page for each project (the sites themselves use
// "[DEFAULT]"), so its sign-in doesn't replace the site's own.
export const appName = (s) => `home-${s.key}`;

// Whether this device has the admin signed in to any of these projects, either on the Access
// page or on the site itself. Firebase keeps the user in localStorage under
// firebase:authUser:<apiKey>:<app name> (every site uses browserLocalPersistence).
export function adminSignedInHere() {
  return SITES.some((s) => [appName(s), s.siteApp || "[DEFAULT]"].some((name) => {
    try {
      const user = JSON.parse(localStorage.getItem(`firebase:authUser:${s.config.apiKey}:${name}`));
      return user?.email?.toLowerCase() === ADMIN_EMAIL;
    } catch {
      return false;
    }
  }));
}
