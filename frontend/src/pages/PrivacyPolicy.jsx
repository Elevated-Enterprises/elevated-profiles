import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-700 mb-6 text-sm transition-colors">
        ← Back
      </Link>

      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-8 prose prose-stone dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-stone-500 text-sm">Last updated: 22 February 2026</p>

        <h2>1. Controller</h2>
        <p>
          The controller responsible for the processing of personal data on this platform is:<br />
          <strong>Ann Kachikova</strong><br />
          Contact: see <Link to="/legal/imprint">Imprint</Link>
        </p>

        <h2>2. What data we process and why</h2>

        <h3>2.1 Authentication via Discord OAuth2</h3>
        <p>
          When you log in, we receive the following data from Discord via the OAuth2 protocol:
        </p>
        <ul>
          <li>Discord User ID</li>
          <li>Discord username</li>
          <li>Guild membership status (to verify server membership)</li>
        </ul>
        <p>
          <strong>Legal basis:</strong> Art. 6(1)(b) GDPR — processing is necessary to provide the service you requested
          (authentication and access control).
        </p>
        <p>
          This data is stored in our database to maintain your account. Your Discord User ID is used as a
          persistent identifier. Your Discord username is updated on every login.
        </p>

        <h3>2.2 Profile data (voluntary)</h3>
        <p>
          You may optionally provide the following information in your profile:
        </p>
        <ul>
          <li>Display name (alternative name)</li>
          <li>Date of birth (year displayed publicly, if visibility permits)</li>
          <li>City and country</li>
          <li>Profile picture (uploaded image)</li>
          <li>Bio text</li>
          <li>D&D alignment</li>
          <li>Skills and LLM experience entries</li>
          <li>Companion profiles (name, bio, image, etc.)</li>
        </ul>
        <p>
          <strong>Legal basis:</strong> Art. 6(1)(a) GDPR — your explicit consent by entering and saving this data.
        </p>
        <p>
          All profile fields are optional. You control the visibility of each field (Private, Members Only, Public)
          via the settings in your profile. You may delete or update your data at any time.
        </p>

        <h3>2.3 Session token and preference storage</h3>
        <p>
          After login, a JWT (JSON Web Token) is stored in your browser's local storage. This token is used to
          authenticate your requests. It expires after 24 hours. This is strictly necessary for the service to function
          and does not require separate consent under Art. 5(3) ePrivacy Directive.
        </p>
        <p>
          Additionally, we store the following preference data locally in your browser:
        </p>
        <ul>
          <li><strong>sc_sort</strong> (browser cookie, 1 year): Remembers your preferred sort order on the profiles overview.</li>
          <li><strong>sc_page_size</strong> (local storage): Remembers how many profiles you prefer to see per page.</li>
        </ul>
        <p>
          These are functional preference cookies and do not track your identity or behaviour across sites.{' '}
          <strong>Legal basis:</strong> Art. 6(1)(b) GDPR — necessary to provide the functionality you have actively configured.
        </p>

        <h3>2.4 OpenDyslexic font (jsDelivr CDN)</h3>
        <p>
          If you enable the OpenDyslexic accessibility font, it is loaded from the{' '}
          <a href="https://www.jsdelivr.com" target="_blank" rel="noopener noreferrer">jsDelivr</a> CDN
          (<code>cdn.jsdelivr.net</code>). This causes a network request from your browser to jsDelivr's servers,
          which may process your IP address. jsDelivr is operated by Prospect One, and their privacy policy
          applies: <a href="https://www.jsdelivr.com/privacy-policy-jsdelivr-net" target="_blank" rel="noopener noreferrer">jsdelivr.com/privacy-policy-jsdelivr-net</a>.
        </p>
        <p>
          The font file is served under the SIL Open Font License 1.1 and is technically required to provide
          the dyslexic font feature. Your font preference is stored locally and in your account settings. No
          tracking cookies are set by jsDelivr for this request.
        </p>
        <p>
          <strong>Legal basis:</strong> Art. 6(1)(a) GDPR — your explicit consent by enabling the feature.
          You can disable the font at any time via the "Aa" toggle in the navigation bar.
        </p>

        <h3>2.5 Usage insights (profile visits, article reads, reactions)</h3>
        <p>
          To help members understand how their content is received, we track the following activity internally:
        </p>
        <ul>
          <li>Profile page visits (which authenticated members viewed your profile and when)</li>
          <li>Thought reads (which authenticated members opened a thought and when)</li>
          <li>Academy article reads (which authenticated members read an article and when)</li>
          <li>Reactions to profiles, companions, thoughts, and Academy articles</li>
        </ul>
        <p>
          This data is used exclusively to provide the "Insights" feature to content owners and administrators,
          and to help us understand what content is valuable to our community. We use these insights to see
          what works and what does not resonate, so we can improve the platform and our content.
        </p>
        <p>
          <strong>We will never share, sell, or publish this data to third parties.</strong> Insight data is
          only visible to the respective content owner (for their own profiles, companions, and thoughts) and
          to administrators (for Academy articles and platform-wide statistics).
        </p>
        <p>
          Administrators are excluded from all insight counts and visitor lists to ensure accuracy.
        </p>
        <p>
          <strong>Legal basis:</strong> Art. 6(1)(f) GDPR — legitimate interest in providing personalised
          content performance feedback within a closed, private community platform.
        </p>

        <h3>2.6 Server access logs</h3>
        <p>
          Our web server may log standard HTTP access data (IP address, timestamp, requested URL, browser user agent).
          These logs are used for security and operational purposes and are not linked to individual user accounts beyond
          what is technically unavoidable.
        </p>
        <p>
          <strong>Legal basis:</strong> Art. 6(1)(f) GDPR — legitimate interest in operating a secure service.
        </p>

        <h2>3. Data recipients</h2>
        <p>
          We do not sell, rent, or share your personal data with third parties for commercial purposes.
        </p>
        <p>
          Data is shared with:
        </p>
        <ul>
          <li>
            <strong>Discord Inc.</strong> — solely to the extent required for the OAuth2 authentication flow.
            Discord's privacy policy applies: <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">discord.com/privacy</a>
          </li>
          <li>
            <strong>jsDelivr (Prospect One)</strong> — solely when you enable the OpenDyslexic font, your browser
            loads the font file from their CDN. See section 2.4 above.
          </li>
          <li>
            <strong>Hosting provider</strong> — the server infrastructure provider processes data as a data processor
            under a data processing agreement (Art. 28 GDPR).
          </li>
        </ul>

        <h2>4. Data retention</h2>
        <p>
          Your account data is retained as long as you are a member of the associated Discord server.
          Profile data you have entered remains in the database unless you delete it or request deletion.
          Server access logs are retained for a maximum of 30 days.
        </p>

        <h2>5. Your rights (GDPR)</h2>
        <p>Under the General Data Protection Regulation, you have the right to:</p>
        <ul>
          <li><strong>Access</strong> (Art. 15 GDPR): Request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification</strong> (Art. 16 GDPR): Correct inaccurate or incomplete data.</li>
          <li><strong>Erasure</strong> (Art. 17 GDPR): Request deletion of your data ("right to be forgotten").</li>
          <li><strong>Restriction</strong> (Art. 18 GDPR): Request that we restrict processing of your data.</li>
          <li><strong>Data portability</strong> (Art. 20 GDPR): Receive your data in a structured, machine-readable format.</li>
          <li><strong>Objection</strong> (Art. 21 GDPR): Object to processing based on legitimate interests.</li>
          <li><strong>Withdrawal of consent</strong> (Art. 7(3) GDPR): Withdraw consent at any time without affecting prior processing.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us via the details in the <Link to="/legal/imprint">Imprint</Link>.
          We will respond within 30 days.
        </p>
        <p>
          You also have the right to lodge a complaint with a supervisory authority. In Germany, this is the data
          protection authority responsible for your place of residence or the controller's location.
        </p>

        <h2>6. Digital Services Act (DSA)</h2>
        <p>
          This platform is a small online platform within the meaning of the Digital Services Act (EU) 2022/2065.
          The platform is accessible only to members of a private Discord server and does not meet the threshold of
          a "very large online platform". No targeted advertising or recommender systems based on profiling are used.
        </p>

        <h2>7. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The date at the top of this page indicates when it was
          last revised. We encourage you to review this page periodically.
        </p>

        <h2>8. Contact</h2>
        <p>
          For privacy-related inquiries, please contact us via the details in the <Link to="/legal/imprint">Imprint</Link>.
        </p>
      </div>
    </div>
  )
}
