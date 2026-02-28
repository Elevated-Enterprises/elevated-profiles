import { Link } from 'react-router-dom'

export default function Imprint() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-700 mb-6 text-sm transition-colors">
        ← Back
      </Link>

      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-8 prose prose-stone dark:prose-invert max-w-none">
        <h1>Imprint</h1>
        <p className="text-stone-500 text-sm">Information in accordance with § 5 TMG (German Telemedia Act)</p>

        <h2>Responsible party</h2>
        <p>
          <strong>Ann Kachikova</strong><br />
          Bulgaria, 9025, Vazrajdane, block 57, section 3, ap.79
        </p>

        <h2>Contact</h2>
        <p>
          <a href="https://discord.gg/secondcircuit">Contact via the Second Circuit Discord server.</a>
        </p>

        <h2>Responsible for editorial content</h2>
        <p>
          Ann Kachikova (address as above)
        </p>

        <h2>Dispute resolution</h2>
        <p>
          The European Commission provides a platform for online dispute resolution (OS):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p>
          We are not willing or obliged to participate in dispute resolution proceedings before a
          consumer arbitration board.
        </p>

        <h2>Liability for content</h2>
        <p>
          As a service provider, we are responsible for our own content on these pages in accordance with
          general law pursuant to § 7(1) TMG. According to §§ 8–10 TMG, however, we are not obligated to
          monitor transmitted or stored third-party information or to investigate circumstances that indicate
          illegal activity.
        </p>
        <p>
          Obligations to remove or block the use of information under general law remain unaffected. Liability
          in this regard is only possible from the time of knowledge of a specific infringement. Upon notification
          of relevant violations, we will remove this content immediately.
        </p>

        <h2>Liability for links</h2>
        <p>
          Our offer contains links to external websites of third parties, on whose contents we have no influence.
          Therefore, we cannot assume any liability for these external contents. The respective provider or operator
          of the pages is always responsible for the contents of the linked pages.
        </p>

        <h2>Copyright</h2>
        <p>
          The content and works created by the site operators on these pages are subject to German copyright law.
          User-generated profile content (texts, images) remains the intellectual property of the respective users.
          By uploading content, users grant the platform a non-exclusive license to display that content to other
          members as configured by the user's visibility settings.
        </p>

        <p>
          <Link to="/legal/privacy-policy">→ Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
