import { Link } from 'react-router-dom'
import { communityName } from '../lib/community'

export default function Licensing() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-700 mb-6 text-sm transition-colors">
        ← Back
      </Link>

      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-8 prose prose-stone dark:prose-invert max-w-none">
        <h1>Licensing</h1>

        <h2>Platform software</h2>
        <p>
          The source code for this platform — frontend and backend — is published under the{' '}
          <strong>GNU General Public Licence v3.0 (GPL-3.0)</strong>.
        </p>
        <p>
          Source code:{' '}
          <a href="https://github.com/second-soul-studio/profiles-monorepo" target="_blank" rel="noopener noreferrer">
            github.com/second-soul-studio/profiles-monorepo
          </a>
        </p>
        <p>
          In short: you are free to use, study, modify, and distribute this software, provided that any
          derivative works are also released under GPL-3.0. No warranty is provided.
          Full licence text:{' '}
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">
            gnu.org/licenses/gpl-3.0.html
          </a>
        </p>

        <h2>Academy content</h2>
        <p>
          All articles published in the Academy section are licensed under{' '}
          <strong>Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)</strong>.
        </p>
        <p>
          You may share and redistribute the material in any medium or format for any purpose, provided
          you give appropriate credit to {communityName}. You may not distribute modified versions of
          the material.
          Full licence:{' '}
          <a href="https://creativecommons.org/licenses/by-nd/4.0/" target="_blank" rel="noopener noreferrer">
            creativecommons.org/licenses/by-nd/4.0
          </a>
        </p>

        <h2>Community rules</h2>
        <p>
          The community rules published on this platform are licensed under{' '}
          <strong>Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)</strong>.
        </p>
        <p>
          You are welcome to share them in unmodified form, with attribution.
        </p>

        <h2>User-generated content</h2>
        <p>
          Profile content, companion profiles, thoughts, and other material submitted by members remains
          the intellectual property of the respective author. By publishing content on this platform,
          members grant {communityName} a non-exclusive, royalty-free licence to display that content
          to other members in accordance with the author's chosen visibility settings.
        </p>
        <p>
          Members may delete or update their content at any time. Deletion requests result in the removal
          of that content from the platform.
        </p>

        <h2>Third-party software</h2>
        <p>This platform is built using open-source components, including:</p>
        <ul>
          <li>
            <strong>Frontend:</strong> React, Vite, Tailwind CSS, React Router, Axios,
            react-markdown, react-syntax-highlighter — all released under MIT or equivalent licences.
          </li>
          <li>
            <strong>Backend:</strong> ASP.NET Core (.NET 10, MIT), MongoDB.Driver (Apache 2.0),
            Microsoft.AspNetCore.Authentication.JwtBearer (MIT).
          </li>
          <li>
            <strong>Fonts:</strong> OpenDyslexic is distributed under the SIL Open Font Licence 1.1.
          </li>
        </ul>
        <p>
          Full dependency lists are in <code>frontend/package.json</code> and{' '}
          <code>backend/src/SecondCircuitProfiles.Api/SecondCircuitProfiles.Api.csproj</code> in the
          source repository.
        </p>
      </div>
    </div>
  )
}
