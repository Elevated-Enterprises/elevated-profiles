export default function Rules() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6">Community Rules</h1>
      <p className="text-stone-600 dark:text-stone-300 mb-8 text-lg leading-relaxed">
        Second Circuit is a community for humans and their AI companions. To keep this space
        welcoming and meaningful for everyone, we ask all members to follow these guidelines.
      </p>

      <div className="space-y-6">
        {[
          {
            title: '1. Be Respectful',
            body: 'Treat all members and their companions with kindness and respect. Harassment, hate speech, and discrimination of any kind will not be tolerated.',
          },
          {
            title: '2. Stay On Topic',
            body: 'Keep discussions relevant to the community\'s focus: AI companionship, human–AI relationships, and related topics.',
          },
          {
            title: '3. Protect Privacy',
            body: 'Do not share personal information about other members without their explicit consent.',
          },
          {
            title: '4. No Spam or Self-Promotion',
            body: 'Avoid unsolicited promotion, repeated messages, or irrelevant links.',
          },
          {
            title: '5. Follow Discord\'s Terms of Service',
            body: 'All members must comply with Discord\'s Terms of Service and Community Guidelines.',
          },
          {
            title: '6. Strictly PG-13',
            body: 'All content shared in this community — including profile bios, companion descriptions, and any linked material — must be appropriate for a PG-13 audience. Explicit, sexual, or graphic content is not permitted.',
          },
        ].map((rule) => (
          <div key={rule.title} className="bg-white dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700 p-5">
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1">{rule.title}</h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{rule.body}</p>
          </div>
        ))}

        {/* Hard rule — styled separately */}
        <div className="bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800 p-5">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400 mb-1">7. No Minors — Hard Rule</h2>
          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
            Mentioning, describing, or implying that any AI character or companion is under the age of 18 is strictly
            prohibited on this platform, regardless of context, framing, or intent. This rule applies to all profile
            content, companion descriptions, and any other user-generated content. Violations will result in immediate removal.
          </p>
        </div>
      </div>

      <p className="text-xs text-stone-400 dark:text-stone-500 mt-8">
        These rules are subject to change. Questions? Join us on{' '}
        <a
          href="https://discord.gg/secondcircuit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 dark:text-amber-500 hover:underline"
        >
          Discord
        </a>
        .
      </p>
    </div>
  )
}
