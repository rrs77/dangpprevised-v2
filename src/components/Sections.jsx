import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { paragraphs, useSite } from "../lib/site.jsx";

function bandClass(section) {
  return `band band-${section.spacing || "normal"} band-${section.background || "paper"}`;
}

function Heading({ text, as: Tag = "h2", accent = true }) {
  const lines = String(text || "").split("\n");
  return (
    <Tag>
      {lines.map((line, index) => (
        <span key={index} className={accent && index > 0 ? "accent-line" : undefined}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </Tag>
  );
}

function Links({ section }) {
  const site = useSite();
  const items = [
    [section.linkLabel, section.linkHref],
    [section.link2Label, section.link2Href],
    [section.link3Label, section.link3Href],
  ].filter(([label, href]) => label && href);
  if (!items.length) return null;
  const hrefFor = (href) => {
    if (!site.preview || href.startsWith("#") || !href.startsWith("/")) return href;
    return href === "/" ? "/preview" : `/preview${href}`;
  };
  return (
    <div className="link-row">
      {items.map(([label, href], index) => {
        const dest = hrefFor(href);
        const className = section.linkStyle === "button" && index === 0 ? "button" : "text-link";
        return dest.startsWith("/") || dest.startsWith("#")
          ? <Link key={href + label} className={className} to={dest}>{label}</Link>
          : <a key={href + label} className={className} href={dest}>{label}</a>;
      })}
    </div>
  );
}

function Copy({ section, titleAs = "h2" }) {
  return (
    <div>
      {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
      {section.heading ? <Heading text={section.heading} as={titleAs} accent={section.accentLines !== false} /> : null}
      {section.subheading ? <p className="support">{section.subheading}</p> : null}
      <div className="prose" style={{ marginTop: "1.25rem" }}>
        {paragraphs(section.body).map((paragraph) => <p key={paragraph.slice(0, 40)} className="muted">{paragraph}</p>)}
      </div>
      <Links section={section} />
    </div>
  );
}

export function articleHref(item) {
  if (item.url && /^https?:\/\//i.test(item.url)) return item.url;
  return `/insights/${item.slug || item.id}`;
}

function InsightLink({ item, children }) {
  const href = articleHref(item);
  if (/^https?:\/\//i.test(href)) return <a className="text-link" href={href} target="_blank" rel="noreferrer">{children}</a>;
  return <Link className="text-link" to={href}>{children}</Link>;
}

const PEOPLE_GROUPS = [
  { key: "founding", title: "Founding Partners", columns: 2 },
  { key: "principal", title: "Principals", columns: 2 },
  { key: "associate", title: "Senior Associates", columns: 3 },
];

function personText(person) {
  const parts = paragraphs(person.bio);
  const summary = (person.summary || "").trim() || parts[0] || "";
  return { summary, full: parts };
}

function PeopleGroups({ people }) {
  const visible = people.filter((person) => !person.hidden);
  const known = new Set(PEOPLE_GROUPS.map((group) => group.key));
  const [openId, setOpenId] = useState(null);
  const opener = useRef(null);
  const openPerson = visible.find((person) => person.id === openId) || null;
  function open(person, trigger) {
    opener.current = trigger;
    setOpenId(person.id);
  }
  function close() {
    setOpenId(null);
    const trigger = opener.current;
    if (trigger) requestAnimationFrame(() => trigger.focus());
  }
  return (
    <div className="people-list">
      {PEOPLE_GROUPS.map((group) => {
        const members = visible
          .filter((person) => (known.has(person.group) ? person.group : "associate") === group.key)
          .sort((a, b) => a.order - b.order);
        if (!members.length) return null;
        return <Group key={group.key} title={group.title} people={members} columns={group.columns} onOpen={open} />;
      })}
      {openPerson ? <BioModal person={openPerson} onClose={close} /> : null}
    </div>
  );
}

function Group({ title, people, columns, onOpen }) {
  return (
    <section className={people.length > 2 ? "people-group wide" : "people-group"} aria-label={title}>
      <h2 className="group-label">{title}</h2>
      <div className={columns === 3 ? "people-grid three" : "people-grid"}>
        {people.map((person) => <Person key={person.id} person={person} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function Portrait({ person, framed = true }) {
  const x = person.photoX ?? 50;
  const y = person.photoY ?? 30;
  return (
    <div className={framed ? "portrait portrait-framed" : "portrait"}>
      <img
        src={person.photo}
        alt={person.photoAlt ? `Portrait of ${person.photoAlt}` : `Portrait of ${person.name}`}
        loading="lazy"
        style={{ objectPosition: `${x}% ${y}%`, transform: `scale(${person.photoZoom || 1})`, transformOrigin: `${x}% ${y}%` }}
      />
    </div>
  );
}

function PersonLinks({ person }) {
  const links = (person.links || []).filter((link) => link.href);
  if (!links.length) return null;
  return (
    <div className="person-links">
      {links.map((link) => (
        <a key={link.href} className="person-link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on ${link.label || "LinkedIn"} (opens in a new tab)`}>
          {link.label || "Link"} <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}

function Person({ person, onOpen }) {
  const { summary, full } = personText(person);
  const hasMore = full.length > 0;
  return (
    <article
      className={`${person.photo ? "person" : "person no-photo"}${hasMore ? " is-openable" : ""}`}
      onClick={hasMore ? (event) => {
        if (event.target.closest("a, button")) return;
        onOpen(person, event.currentTarget.querySelector(".person-open"));
      } : undefined}
    >
      {person.photo ? <Portrait person={person} /> : null}
      <div className="person-content">
        <p className="role">{person.role}</p>
        <h3>{person.name}</h3>
        {person.specialism ? <p className="specialism">{person.specialism}</p> : null}
        {summary ? <p className="person-summary">{summary}</p> : null}
        {hasMore ? (
          <button type="button" className="person-open" aria-haspopup="dialog" onClick={(event) => onOpen(person, event.currentTarget)}>
            Read full biography<span className="sr-only">: {person.name}</span> <span aria-hidden="true">↗</span>
          </button>
        ) : null}
        <PersonLinks person={person} />
      </div>
    </article>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function BioModal({ person, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const { full } = personText(person);
  const titleId = `bio-title-${person.id}`;

  useEffect(() => {
    const node = dialog.current;
    if (node && typeof node.showModal === "function" && !node.open) node.showModal();
    closeButton.current?.focus();
    const scrollY = window.scrollY;
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
      window.scrollTo(0, scrollY);
    };
  }, []);

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...dialog.current.querySelectorAll(FOCUSABLE)].filter((item) => item.offsetParent !== null || item === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialog}
      className="bio-modal"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="bio-panel">
        <button ref={closeButton} type="button" className="bio-close" onClick={onClose} aria-label="Close biography">
          <span aria-hidden="true">×</span>
        </button>
        <div className="bio-head">
          {person.photo ? <Portrait person={person} framed={false} /> : null}
          <div>
            <p className="role">{person.role}</p>
            <h2 id={titleId}>{person.name}</h2>
            {person.specialism ? <p className="specialism">{person.specialism}</p> : null}
            <PersonLinks person={person} />
          </div>
        </div>
        <div className="prose bio-body">
          {person.summary && !full.includes(person.summary.trim()) ? <p>{person.summary}</p> : null}
          {full.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)}
        </div>
      </div>
    </dialog>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function LinkedInPosts({ posts, limit }) {
  const shown = posts.slice(0, limit || posts.length);
  if (!shown.length) return <p className="muted">LinkedIn posts will appear here.</p>;
  return (
    <ul className="li-grid">
      {shown.map((post) => (
        <li key={post.id} className="li-card">
          {post.embedUrl ? (
            <iframe className="li-embed" src={post.embedUrl} title={post.title || `LinkedIn post by ${post.author || "Global Place Partners"}`} loading="lazy" allowFullScreen />
          ) : post.image ? (
            <img className="li-image" src={post.image} alt={post.imageAlt || ""} loading="lazy" />
          ) : null}
          <div className="li-body">
            <p className="li-meta">
              <span className="li-badge" aria-hidden="true">in</span>
              {[post.author, formatDate(post.date)].filter(Boolean).join(" · ")}
            </p>
            {post.title ? <h3>{post.title}</h3> : null}
            {post.excerpt ? <p className="muted li-excerpt">{post.excerpt}</p> : null}
            <a className="text-link" href={post.url} target="_blank" rel="noopener noreferrer">
              Read on LinkedIn<span className="sr-only">{post.title ? `: ${post.title}` : ""} (opens in a new tab)</span>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Capabilities({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="capabilities" aria-label="Connected areas of economic development">
      {items.map((item) => <li key={item.id}>{item.title}</li>)}
    </ul>
  );
}

function Tiles({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="tiles" aria-label="Connected areas of economic development">
      {items.map((item, index) => (
        <li key={item.id} className={`tile tile-${(index % 6) + 1}`}>
          <span className="tile-mark" aria-hidden="true" />
          <h3>{item.title}</h3>
          {item.text ? <p>{item.text}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function PortraitStrip({ people }) {
  const visible = (people || []).filter((person) => !person.hidden && person.photo);
  if (!visible.length) return null;
  const rank = { founding: 0, principal: 1, associate: 2 };
  const ordered = [...visible].sort((a, b) => (rank[a.group] ?? 3) - (rank[b.group] ?? 3) || a.order - b.order);
  return (
    <ul className="portrait-strip" aria-label="Our people">
      {ordered.map((person) => (
        <li key={person.id}>
          <span className="portrait portrait-round">
            <img src={person.photo} alt="" style={{ objectPosition: `${person.photoX ?? 50}% ${person.photoY ?? 30}%` }} />
          </span>
          <span className="strip-name">{person.name}</span>
        </li>
      ))}
    </ul>
  );
}

function InsightsList({ insights }) {
  if (!insights.length) return <p>Published perspectives will appear here.</p>;
  const featured = insights.find((item) => item.featured) || insights[0];
  const rest = insights.filter((item) => item.id !== featured.id);
  return (
    <div>
      <article className="insight-feature">
        <div>
          <p className="kicker">Featured {featured.category ? `· ${featured.category}` : ""}</p>
          <h2 style={{ marginTop: "0.6rem" }}>{featured.title}</h2>
          <p className="muted">{featured.summary}</p>
          <p className="note">{[featured.author, featured.source].filter(Boolean).join(" · ")}</p>
          <InsightLink item={featured}>Read the insight</InsightLink>
        </div>
        {featured.image ? <img src={featured.image} alt={featured.imageAlt || ""} /> : null}
      </article>
      <div className="insight-grid">
        {rest.map((item) => (
          <article key={item.id}>
            <p className="kicker">{item.category || item.source}</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.summary}</p>
            <InsightLink item={item}>Read the insight</InsightLink>
          </article>
        ))}
      </div>
    </div>
  );
}

function ContactForm({ section = {} }) {
  const { content } = useSite();
  const form = content.settings.form;
  const email = content.settings.contact?.email;
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState([]);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/form-token", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) setToken(data.token || ""); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextErrors = [];
    if (!String(data.get("name") || "").trim()) nextErrors.push("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email") || "").trim())) nextErrors.push("Enter a valid email.");
    if (!String(data.get("organisation") || "").trim()) nextErrors.push("Enter your organisation.");
    if (!String(data.get("project") || "").trim()) nextErrors.push("Enter a message.");
    if (!data.get("consent")) nextErrors.push("Consent is needed so we can reply.");
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setPending(true);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        organisation: data.get("organisation"),
        project: data.get("project"),
        website: data.get("website"),
        consent: true,
        formToken: token,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setErrors(body.details || [body.error || "The enquiry could not be sent."]);
      return;
    }
    setDone(true);
  }

  return (
    <div className="contact-grid">
      <div className="contact-info">
        {section.heading ? <h2>{section.heading}</h2> : null}
        {section.body ? (
          <div className="prose">
            {paragraphs(section.body).map((paragraph) => <p key={paragraph.slice(0, 40)} className="muted">{paragraph}</p>)}
          </div>
        ) : null}
        <div className="contact-details">
          <h2>Contact details</h2>
          <dl>
            <div><dt>General enquiries</dt><dd><a className="contact-email" href={`mailto:${email}`}>{email}</a></dd></div>
            {(section.items || []).filter((item) => item.title).map((item) => (
              <div key={item.id}>
                <dt>{item.title}</dt>
                {item.label ? <dd className="muted">{item.label}</dd> : null}
                {item.text ? <dd><a className="contact-email" href={`mailto:${item.text}`}>{item.text}</a></dd> : null}
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="contact-form">
        <h2>{form.heading}</h2>
        {form.intro ? <p className="muted">{form.intro}</p> : null}
        {done ? <p className="confirm" role="status">{form.confirmation}</p> : (
          <form onSubmit={onSubmit} noValidate>
            {errors.length > 0 && (
              <div role="alert">
                <p className="errors">Please check the form.</p>
                <ul className="errors">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            )}
            <label><span>{form.nameLabel}</span><input name="name" autoComplete="name" required /></label>
            <label><span>{form.organisationLabel}</span><input name="organisation" autoComplete="organization" required /></label>
            <label><span>{form.emailLabel}</span><input name="email" type="email" autoComplete="email" required /></label>
            <label><span>{form.messageLabel}</span><textarea name="project" required /></label>
            <div className="hp" aria-hidden="true">
              <label>Leave this field empty<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label className="check"><input name="consent" type="checkbox" /> <span>{form.consentLabel}</span></label>
            <p><Link to="/privacy">Read the Privacy Policy</Link></p>
            <button className="primary" type="submit" disabled={pending}>{pending ? "Sending…" : form.submitLabel}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Sections({ sections }) {
  const site = useSite();
  return sections.filter((section) => !section.hidden).map((section) => {
    const layout = section.layout === "split" || section.layout === "split-reverse" ? `split ${section.layout === "split-reverse" ? "split-reverse" : ""}` : "";
    if (section.type === "people") {
      return (
        <section key={section.id} id={section.id} className={bandClass(section)}>
          <div className="wrap"><PeopleGroups people={site.content.people || []} /></div>
        </section>
      );
    }
    if (section.type === "insights") {
      return (
        <section key={section.id} id={section.id} className={bandClass(section)}>
          <div className="wrap"><InsightsList insights={site.insights || []} /></div>
        </section>
      );
    }
    if (section.type === "contact") {
      return (
        <section key={section.id} id={section.id} className={bandClass(section)}>
          <div className="wrap"><ContactForm section={section} /></div>
        </section>
      );
    }
    if (section.type === "diagram") {
      const drivers = (section.items || []).filter((item) => item.group !== "capability");
      const capabilities = (section.items || []).filter((item) => item.group === "capability");
      return (
        <section key={section.id} id={section.id} className={bandClass(section)}>
          <div className="wrap">
            <Copy section={section} />
            {section.image ? (
              <>
                <div className="diagram-scroll" tabIndex={0} aria-label="Growth Model diagram. Scroll sideways if the full diagram does not fit.">
                  <img src={section.image} alt={section.imageAlt || "Growth Model diagram"} />
                </div>
                <p className="diagram-help muted">On a phone, scroll the diagram sideways or <a href={section.image}>open it full size</a>.</p>
              </>
            ) : null}
            {drivers.length || capabilities.length ? (
              <details className="diagram-text">
                <summary>Read the Growth Model as text</summary>
                <div className="driver-grid">
                  {drivers.map((item) => (
                    <article key={item.id}><h3>{item.title}</h3><p>{item.text}</p></article>
                  ))}
                </div>
                <ul className="capability-list">
                  {capabilities.map((item) => (
                    <li key={item.id}><h3>{item.title}</h3><p>{item.text}</p></li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      );
    }
    if (section.type === "modes") {
      const intro = section.layout === "split" ? (
        <div className="split work-intro">
          <div>
            {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
            {section.heading ? <Heading text={section.heading} accent={section.accentLines !== false} /> : null}
          </div>
          <div className="prose work-lead">
            {paragraphs(section.body).map((paragraph) => <p key={paragraph.slice(0, 40)} className="muted">{paragraph}</p>)}
          </div>
        </div>
      ) : <Copy section={{ ...section, linkLabel: "", link2Label: "" }} />;
      return (
        <section key={section.id} id={section.id} className={bandClass(section)}>
          <div className="wrap">
            {intro}
            <ol className={section.layout === "split" ? "modes modes-rows" : "modes"}>
              {(section.items || []).map((item) => (
                <li key={item.id}><h3>{item.title}</h3><p>{item.text}</p></li>
              ))}
            </ol>
            <Links section={section} />
          </div>
        </section>
      );
    }
    if (section.type === "linkedin") {
      return (
        <section key={section.id} id={section.id} className={`${bandClass(section)} linkedin-band`}>
          <div className="wrap">
            <div className="li-head">
              <div>
                {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                {section.heading ? <Heading text={section.heading} accent={section.accentLines !== false} /> : null}
              </div>
              <Links section={section} />
            </div>
            <LinkedInPosts posts={site.linkedinPosts || []} limit={Number(section.limit) || 0} />
          </div>
        </section>
      );
    }
    if (section.type === "stats") {
      return (
        <section key={section.id} id={section.id} className={`${bandClass(section)} stats-band`}>
          <div className="wrap">
            {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
            <ul className="stats">
              {(section.items || []).map((item) => (
                <li key={item.id} className={item.placeholder || /^\[/.test(item.title || "") ? "stat is-placeholder" : "stat"}>
                  <span className="stat-value">{item.title}</span>
                  <span className="stat-label">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }
    if (section.type === "quote") {
      return (
        <section key={section.id} id={section.id} className={`${bandClass(section)} quote-band`}>
          <div className="wrap quote-grid">
            <figure className="pull-quote">
              <blockquote><p>{section.heading}</p></blockquote>
              {section.body ? <figcaption>{section.body}</figcaption> : null}
              <Links section={section} />
            </figure>
            {section.image ? <img className="quote-art" src={section.image} alt={section.imageAlt || ""} loading="lazy" /> : null}
          </div>
        </section>
      );
    }
    if (section.type === "diagnostic") {
      return (
        <section key={section.id} id={section.id} className={`${bandClass(section)} diagnostic`}>
          <div className="wrap">
            {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
            {section.heading ? <Heading text={section.heading} accent={section.accentLines !== false} /> : null}
            <div className="prose diagnostic-lead">
              {paragraphs(section.body).map((paragraph) => <p key={paragraph.slice(0, 40)} className="muted">{paragraph}</p>)}
            </div>
            <div className="questions">
              {(section.items || []).map((item) => (
                <article className="question" key={item.id}>
                  {item.label ? <p className="question-label">{item.label}</p> : null}
                  <h3>{item.title}</h3>
                  <p className="muted">{item.text}</p>
                </article>
              ))}
            </div>
            {section.note ? (
              <div className="prose diagnostic-note">
                {paragraphs(section.note).map((paragraph) => <p key={paragraph.slice(0, 40)} className="muted">{paragraph}</p>)}
              </div>
            ) : null}
            {section.result || section.linkLabel ? (
              <div className="diagnostic-result">
                {section.result ? <p className="muted">{renderResult(section.result)}</p> : <span />}
                <Links section={section} />
              </div>
            ) : null}
          </div>
        </section>
      );
    }
    if (section.type === "text" && (section.body2 || section.display === "service" || section.display === "ruled")) {
      const mode = section.display === "service" ? "service" : section.display === "ruled" ? "ruled" : "columns";
      const prose = (text, extra = "") => (
        <div className={`prose${extra}`}>
          {paragraphs(text).map((paragraph) => <p key={paragraph.slice(0, 48)} className="muted">{paragraph}</p>)}
        </div>
      );
      return (
        <section key={section.id} id={section.id} className={`${bandClass(section)} text-${mode}`}>
          <div className="wrap">
            {mode === "columns" ? (
              <>
                {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                {section.heading ? <Heading text={section.heading} accent={section.accentLines !== false} /> : null}
                <div className="columns">
                  {prose(section.body)}
                  <div className="column-ruled">
                    {prose(section.body2, section.emphasis ? " emphasis" : "")}
                    <Links section={section} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {mode === "ruled" && section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                <div className="columns">
                  <div>
                    {mode === "service" && section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                    {section.heading ? <Heading text={section.heading} accent={section.accentLines !== false} /> : null}
                    {section.subheading ? <p className="service-subtitle">{section.subheading}</p> : null}
                  </div>
                  <div className={mode === "ruled" ? "column-ruled" : undefined}>
                    {prose(section.body)}
                    <Links section={section} />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      );
    }
    const titleAs = section.type === "hero" ? "h1" : "h2";
    const splitCopy = (section.layout === "split" || section.layout === "split-reverse") && !section.image;
    const art = section.type === "hero" && section.image ? " hero-art" : "";
    const cta = section.type === "cta" ? " cta-band" : "";
    const rule = section.type === "hero" && splitCopy ? " hero-split-rule" : "";
    return (
      <section key={section.id} id={section.id} className={`${bandClass(section)}${art}${cta}${rule}`}>
        <div className={`wrap ${section.type === "hero" && section.image ? "hero-grid" : layout}`}>
          {splitCopy ? (
            <>
              <div>
                {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                {section.heading ? <Heading text={section.heading} as={titleAs} accent={section.accentLines !== false} /> : null}
                {section.subheading ? <p className="support">{section.subheading}</p> : null}
              </div>
              <div>
                <div className="prose">
                  {paragraphs(section.body).map((paragraph) => <p key={paragraph.slice(0, 48)} className="muted">{paragraph}</p>)}
                </div>
                <Links section={section} />
                {section.display === "tiles" ? null : <Capabilities items={section.items} />}
              </div>
            </>
          ) : (
            <>
              <Copy section={section} titleAs={titleAs} />
              {section.image ? <img className="constellation" src={section.image} alt={section.imageAlt || ""} /> : null}
            </>
          )}
        </div>
        {section.display === "tiles" ? <div className="wrap"><Tiles items={section.items} /></div> : null}
        {section.showPortraits ? <div className="wrap"><PortraitStrip people={site.content.people} /></div> : null}
      </section>
    );
  });
}

function renderResult(text) {
  const match = /^([^:]{1,40}:)(.*)$/s.exec(text);
  if (!match) return text;
  return <><strong>{match[1]}</strong>{match[2]}</>;
}

export function ArticleView({ item }) {
  return (
    <section className="band band-generous band-paper">
      <div className="wrap narrow">
        <p className="eyebrow">{[item.category, item.source].filter(Boolean).join(" · ")}</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>{item.title}</h1>
        <p className="muted">{item.author}</p>
        {item.image ? <img src={item.image} alt={item.imageAlt || ""} /> : null}
        <div className="prose" style={{ marginTop: "1.5rem" }}>
          {paragraphs(item.body || item.summary).map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
        </div>
        {item.url ? <p><a className="text-link" href={item.url}>Original link</a></p> : null}
      </div>
    </section>
  );
}
