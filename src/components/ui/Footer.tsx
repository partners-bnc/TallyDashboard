import Link from 'next/link'

const Footer = () => {
  const sections = [
    {
      title: 'Product',
      items: [
        { name: 'Features', path: '/#features' },
        { name: 'Pricing', path: '/#pricing' },
        { name: 'Documentation', path: '/docs' },
        { name: 'API Access', path: '/api' },
      ]
    },
    {
      title: 'Company',
      items: [
        { name: 'About Us', path: '/about' },
        { name: 'Careers', path: '/careers' },
        { name: 'Blog', path: '/blog' },
        { name: 'Contact', path: '/contact' },
      ]
    },
    {
      title: 'Legal',
      items: [
        { name: 'Privacy Policy', path: '/privacy' },
        { name: 'Terms of Service', path: '/terms' },
      ]
    }
  ]

  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/5e4a8a19-f7b5-4e29-89a9-ad9d693b6111.png"
                alt="TallyOne Ai"
                style={{ width: 180, height: 52, objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            </div>
            <p className="text-gray-600 text-sm">
              Your All-in-One Tally Companion for real-time local & server integration, automated MIS reporting, and AI financial analysis.
            </p>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.path}
                      className="text-gray-600 hover:text-primary transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 mt-8 pt-8">
          <p className="text-center text-gray-500 text-sm">
            © 2026 TallyOne Ai — All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
