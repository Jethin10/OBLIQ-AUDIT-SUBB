import Image from "next/image";
import Link from "next/link";

const navigation = [
  ["Product", "#product"],
  ["Workflow", "#workflow"],
  ["Security", "#security"],
  ["For CA firms", "#firms"],
  ["Contact", "#contact"],
] as const;

export default function Home() {
  return (
    <main className="ario-home">
      <div className="ario-preloader" aria-hidden="true">
        <span className="ario-preloader-o">O</span>
        <span className="ario-preloader-b">B</span>
        <span className="ario-preloader-l">L</span>
        <span className="ario-preloader-i">I</span>
        <span className="ario-preloader-q">Q</span>
      </div>

      <header className="ario-header">
        <Link className="ario-mark" href="/" aria-label="OBLIQ home">
          <strong>OBLIQ</strong>
          <span>AUDIT</span>
        </Link>

        <nav className="ario-nav" aria-label="Primary navigation">
          {navigation.map(([label, href]) => (
            <a key={label} href={href}>{label}</a>
          ))}
        </nav>

        <div className="ario-tools">
          <Link href="/login">Log in</Link>
          <span>En</span>
        </div>
        <Link className="ario-menu" href="/login" aria-label="Open workspace">
          <span />
          <span />
          <span />
        </Link>
      </header>

      <section className="ario-hero" id="product">
        <h1>
          <span>Collect audit evidence without chasing.</span>
          <span>Review corrections with full context.</span>
          <span>Approve documents with confidence.</span>
          <span>Keep every decision traceable.</span>
        </h1>

        <div className="ario-media">
          <Image
            src="/images/audit-desk.png"
            alt="Audit documents arranged for review"
            fill
            priority
            sizes="(max-width: 740px) 100vw, 40vw"
          />
          <div className="ario-media-caption">
            <strong>DOCUMENT REVIEW</strong>
            <span>BUILT FOR CA FIRMS</span>
          </div>
        </div>

        <p className="ario-wordmark" aria-hidden="true">OBLIQ</p>

        <div className="ario-next-section" aria-hidden="true">
          <span>About OBLIQ</span>
          <strong>Evidence in. Decisions recorded.</strong>
        </div>
      </section>

      <section className="landing-about" id="workflow">
        <p className="landing-section-label">How it works</p>
        <h2>Evidence moves.<br />The record holds.</h2>
        <div className="landing-stats">
          <article><strong>01</strong><span>Collect every required document</span></article>
          <article><strong>02</strong><span>Review, correct and approve</span></article>
          <article><strong>03</strong><span>Keep the complete audit trail</span></article>
        </div>
      </section>

      <section className="landing-practices" id="security">
        <div className="landing-practices-intro">
          <h2>Built around the<br />way audit work moves</h2>
          <p>One clear workspace replaces scattered email threads, renamed attachments and review decisions that are hard to reconstruct.</p>
        </div>
        <div className="landing-practice-stage">
          <article className="landing-practice-number">
            <strong>01</strong>
            <span>DOCUMENT CONTROL</span>
          </article>
          <div className="landing-practice-image">
            <Image src="/images/audit-desk.png" alt="Audit evidence ready for review" fill sizes="50vw" priority />
          </div>
          <ol>
            <li><span>01</span>Required-document checklists</li>
            <li><span>02</span>Versioned uploads</li>
            <li><span>03</span>Correction requests</li>
            <li><span>04</span>Review and approval states</li>
          </ol>
        </div>
      </section>

      <section className="landing-team" id="firms">
        <p>For staff and reviewers working together</p>
        <h2>ONE<br />TEAM</h2>
        <div className="landing-team-cards">
          <article><span>STAFF</span><strong>Upload the evidence</strong></article>
          <article><span>REVIEWER</span><strong>Make the decision</strong></article>
          <article><span>FIRM</span><strong>Retain the record</strong></article>
        </div>
      </section>

      <section className="landing-proof">
        <div className="landing-proof-grid">
          <div className="landing-proof-portrait">
            <Image src="/images/audit-desk.png" alt="Organised audit documents" fill sizes="40vw" priority />
          </div>
          <div className="landing-proof-copy">
            <p>WHAT OBLIQ RECORDS</p>
            <h2>Every upload.<br />Every correction.<br />Every approval.</h2>
          </div>
        </div>
        <div className="landing-proof-line">
          <span>2026</span>
          <strong>Document review built for CA firms</strong>
          <span>+</span>
        </div>
      </section>

      <section className="landing-contact" id="contact">
        <p>Ready to bring the audit trail into one place?</p>
        <Link href="/login">Enter the workspace <span>+</span></Link>
        <div className="landing-contact-word">OBLIQ</div>
        <footer>
          <Link className="ario-mark" href="/" aria-label="OBLIQ home">
            <strong>OBLIQ</strong><span>AUDIT</span>
          </Link>
          <nav>{navigation.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</nav>
          <Link href="/login">Log in</Link>
        </footer>
      </section>

      <div className="ario-access-bar">
        <p>One workspace for evidence, corrections and audit history</p>
        <Link href="/login">Enter workspace <span aria-hidden="true">+</span></Link>
      </div>
    </main>
  );
}
