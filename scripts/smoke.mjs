const base = process.env.BASE || "http://127.0.0.1:3001";

async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...(options.headers || {}) }, redirect: "manual" });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await request("/api/health");
assert(health.json?.ok, "health failed");

const content = await request("/api/content");
const home = content.json.pages.find((page) => page.slug === "home");
assert(home.sections[0].heading === "Regional growth.\nJoined up.", "hero heading");
assert(home.sections[0].subheading === "Turning regional ambition into economic growth.", "supporting headline");
const contact = content.json.pages.find((page) => page.slug === "contact");
assert(contact.sections[0].heading === "Ambitious for your place? So are we.", "contact headline");
for (const slug of ["about", "our-work", "growth-model", "people", "insights", "contact"]) {
  assert(content.json.pages.some((page) => page.slug === slug), `missing ${slug}`);
}
assert(!content.json.secrets, "secrets leaked");
assert(content.json.people.some((person) => person.name === "Dan Storer" && person.photo), "Dan missing");

const insights = await request("/api/insights");
assert(insights.json.some((item) => item.url.includes("danielfstorer_the-uks-new-industrial-strategy")), "industrial strategy article missing");
assert(insights.json.some((item) => item.url.includes("strategic-investment-beyond-frontier-economy")), "frontier article missing");

const badLogin = await request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
assert(badLogin.status === 401, "bad login should fail");

const login = await request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
assert(login.json?.role === "superuser", "superuser login failed");
const cookie = login.headers.get("set-cookie").split(";")[0];
const auth = { headers: { "Content-Type": "application/json", cookie } };

const draft = await request("/api/admin/draft", { headers: { cookie } });
const marker = "Edited from the admin.";
const original = draft.json.pages[0].sections[0].subheading;
draft.json.pages[0].sections[0].subheading = marker;
const saved = await request("/api/admin/draft", { method: "PUT", ...auth, body: JSON.stringify(draft.json) });
assert(saved.json.success, "save draft failed");
const still = await request("/api/content");
assert(still.json.pages[0].sections[0].subheading !== marker, "draft leaked to public");
const published = await request("/api/admin/publish", { method: "POST", ...auth, body: JSON.stringify({ note: "Smoke publish" }) });
assert(published.json.success, "publish failed");
const after = await request("/api/content");
assert(after.json.pages[0].sections[0].subheading === marker, "publish did not change public content");
// Put the real supporting line back so the smoke run never leaves its marker on the site.
const cleanDraft = await request("/api/admin/draft", { headers: { cookie } });
cleanDraft.json.pages[0].sections[0].subheading = original;
await request("/api/admin/draft", { method: "PUT", ...auth, body: JSON.stringify(cleanDraft.json) });
const republished = await request("/api/admin/publish", { method: "POST", ...auth, body: JSON.stringify({ note: "Smoke cleanup" }) });
assert(republished.json.success, "cleanup publish failed");
const cleaned = await request("/api/content");
assert(cleaned.json.pages[0].sections[0].subheading === original, "smoke marker was left on the site");

// Employees: add with an uploaded photo, publish, check the public site, reorder, then delete.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("image", new Blob([png], { type: "image/png" }), "smoke.png");
form.append("alt", "Smoke Tester");
const uploaded = await request("/api/admin/upload", { method: "POST", headers: { cookie }, body: form });
assert(uploaded.json?.url?.startsWith("/api/media/"), "photo upload failed");
const photo = await fetch(base + uploaded.json.url);
assert(photo.ok && photo.headers.get("content-type") === "image/png", "uploaded photo not served");

const peopleDraft = (await request("/api/admin/draft", { headers: { cookie } })).json;
const newcomer = {
  id: "smoke-person",
  name: "Smoke Tester",
  role: "Senior Associate",
  group: "associate",
  order: 99,
  hidden: false,
  photo: uploaded.json.url,
  photoAlt: "Smoke Tester",
  specialism: "Testing · Quality",
  summary: "Short card summary.",
  bio: "Full biography paragraph one.\n\nFull biography paragraph two.",
  links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/example" }, { label: "Bad", href: "javascript:alert(1)" }],
};
peopleDraft.people.push(newcomer);
assert((await request("/api/admin/draft", { method: "PUT", ...auth, body: JSON.stringify(peopleDraft) })).json.success, "save person failed");
const reloaded = (await request("/api/admin/draft", { headers: { cookie } })).json.people.find((item) => item.id === "smoke-person");
assert(reloaded && reloaded.summary === "Short card summary." && reloaded.specialism === "Testing · Quality", "person fields not saved");
assert(reloaded.links.length === 1 && reloaded.links[0].href === "https://www.linkedin.com/in/example", "unsafe link was not removed");
assert((await request("/api/admin/publish", { method: "POST", ...auth, body: JSON.stringify({ note: "Smoke person" }) })).json.success, "publish person failed");
const publicPerson = (await request("/api/content")).json.people.find((item) => item.id === "smoke-person");
assert(publicPerson?.photo === uploaded.json.url && publicPerson.bio.includes("paragraph two"), "person not public after publish");

const reorderDraft = (await request("/api/admin/draft", { headers: { cookie } })).json;
reorderDraft.people.find((item) => item.id === "smoke-person").order = 0;
reorderDraft.people.find((item) => item.id === "smoke-person").hidden = true;
await request("/api/admin/draft", { method: "PUT", ...auth, body: JSON.stringify(reorderDraft) });
const reordered = (await request("/api/admin/draft", { headers: { cookie } })).json.people.find((item) => item.id === "smoke-person");
assert(reordered.order === 0 && reordered.hidden === true, "reorder or hide not saved");

const removeDraft = (await request("/api/admin/draft", { headers: { cookie } })).json;
removeDraft.people = removeDraft.people.filter((item) => item.id !== "smoke-person");
await request("/api/admin/draft", { method: "PUT", ...auth, body: JSON.stringify(removeDraft) });
await request("/api/admin/publish", { method: "POST", ...auth, body: JSON.stringify({ note: "Smoke person removed" }) });
assert(!(await request("/api/content")).json.people.some((item) => item.id === "smoke-person"), "person not deleted");

// LinkedIn posts: create, edit, hide, delete.
const seededPosts = (await request("/api/linkedin-posts")).json;
assert(Array.isArray(seededPosts) && seededPosts.length >= 2, "seeded LinkedIn posts missing");
const badPost = await request("/api/admin/linkedin-posts", { method: "POST", ...auth, body: JSON.stringify({ url: "javascript:alert(1)" }) });
assert(badPost.status === 400, "unsafe post URL accepted");
const post = (await request("/api/admin/linkedin-posts", { method: "POST", ...auth, body: JSON.stringify({ url: "https://www.linkedin.com/posts/example-smoke", title: "Smoke post", excerpt: "Excerpt", author: "Smoke", date: "2030-01-02", embedUrl: "https://evil.example/embed" }) })).json;
assert(post?.id && post.embedUrl === "", "post create failed or unsafe embed kept");
assert((await request("/api/linkedin-posts")).json[0].id === post.id, "newest post should be first");
await request(`/api/admin/linkedin-posts/${post.id}`, { method: "PUT", ...auth, body: JSON.stringify({ ...post, title: "Smoke post edited", hidden: true }) });
assert(!(await request("/api/linkedin-posts")).json.some((item) => item.id === post.id), "hidden post still public");
assert((await request("/api/admin/linkedin-posts", { headers: { cookie } })).json.find((item) => item.id === post.id)?.title === "Smoke post edited", "post edit not saved");
await request(`/api/admin/linkedin-posts/${post.id}`, { method: "DELETE", headers: { cookie } });
assert(!(await request("/api/admin/linkedin-posts", { headers: { cookie } })).json.some((item) => item.id === post.id), "post not deleted");

const editor = await request("/api/admin/users", { method: "POST", ...auth, body: JSON.stringify({ name: "Editor", email: "editor@example.com", password: "editor-pass-1", role: "editor" }) });
assert(editor.json.success, "create editor failed");
const editorLogin = await request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "editor@example.com", password: "editor-pass-1" }) });
assert(editorLogin.json.role === "editor", "editor login failed");
const editorCookie = editorLogin.headers.get("set-cookie").split(";")[0];
const denied = await request("/api/admin/users", { headers: { cookie: editorCookie } });
assert(denied.status === 403, "editor should not manage users");

const article = await request("/api/admin/insights", { method: "POST", ...auth, body: JSON.stringify({ title: "Draft only note", summary: "Not public", status: "draft", url: "https://example.com/not-real" }) });
assert(article.json?.id, "article create failed");
const publicInsights = await request("/api/insights");
assert(!publicInsights.json.some((item) => item.title === "Draft only note"), "draft article was public");
await request(`/api/admin/insights/${article.json.id}`, { method: "PUT", ...auth, body: JSON.stringify({ ...article.json, status: "published" }) });
const shown = await request("/api/insights");
assert(shown.json.some((item) => item.title === "Draft only note"), "published article missing");
await request(`/api/admin/insights/${article.json.id}`, { method: "DELETE", headers: { cookie } });

const revisions = await request("/api/admin/revisions", { headers: { cookie } });
assert(revisions.json.length > 0, "no revisions");
const restored = await request("/api/admin/rollback", { method: "POST", ...auth, body: JSON.stringify({ id: revisions.json[0].id }) });
assert(restored.status === 200 || restored.json?.error, JSON.stringify(restored.json));

const sent = await request("/api/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Ada Tester", email: "ada@example.com", organisation: "Test Place", project: "Checking the form.", consent: true, captchaToken: "test-token", website: "" }),
});
assert(sent.json?.success, `contact failed ${sent.status} ${sent.text}`);
const honeypot = await request("/api/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Bot", email: "bot@example.com", organisation: "X", project: "spam", consent: true, captchaToken: "test-token", website: "http://spam.test" }),
});
assert(honeypot.json?.success, "honeypot should pretend success");

if (process.env.CHECK_PAGES === "1") {
  for (const path of ["/", "/about", "/our-work", "/growth-model", "/people", "/insights", "/contact", "/privacy", "/cookies"]) {
    const page = await request(path);
    assert(page.status === 200 && page.text.includes("Global Place Partners"), `${path} did not render`);
  }
  const services = await request("/services");
  assert(services.status === 301 && services.headers.get("location") === "/our-work", "services redirect");
  const team = await request("/team");
  assert(team.status === 301 && team.headers.get("location") === "/people", "team redirect");
}

console.log("smoke ok");
