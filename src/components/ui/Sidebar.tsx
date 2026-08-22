"use client";

import { Suspense } from 'react'
import Link from 'next/link'
import { X, Database, BarChart3, Image as ImageIcon, Calculator, User, Settings, CreditCard, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { authClient } from '@/lib/auth/client'



interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const SidebarInner = ({ isOpen, onClose }: SidebarProps) => {
  const sections = [
    {
      title: 'Core Analytics',
      items: [
        { name: 'Financial Dashboard', path: '/dashboard', icon: BarChart3 },
        { name: 'Ledger Explorer', path: '/dashboard', icon: Database },
      ]
    },
    {
      title: 'AI & Automation',
      items: [
        { name: 'AI Financial Chat', path: '/dashboard', icon: BarChart3 },
        { name: 'MIS Automated Reports', path: '/dashboard', icon: Database },
        { name: 'Email Trigger System', path: '/dashboard', icon: Database },
      ]
    },
    {
      title: 'Integration',
      items: [
        { name: 'Local Connection Settings', path: '/dashboard', icon: Settings },
        { name: 'Cloud Server Setup', path: '/dashboard', icon: Settings },
      ]
    },
    {
      title: 'User',
      items: [
        { name: 'Profile', path: '/dashboard', icon: User },
        { name: 'Billing', path: '/dashboard', icon: CreditCard },
        { name: 'Logout', path: '/login', icon: LogOut },
      ]
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto rounded-tr-[2rem] rounded-br-[2rem]"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/5e4a8a19-f7b5-4e29-89a9-ad9d693b6111.png"
                  alt="TallyOne Ai"
                  style={{ width: 180, height: 52, objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                {sections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {section.title}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.name}
                            href={item.path}
                            onClick={async (e) => {
                              if (item.name === 'Logout') {
                                e.preventDefault()
                                try {
                                  await authClient.signOut()
                                  await fetch('/auth/signout', { method: 'POST' })
                                } catch (err) {
                                  // Ignore
                                } finally {
                                  window.location.assign('/login')
                                }
                              } else {
                                onClose()
                              }
                            }}
                            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                          >
                            <Icon className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                            <span className="text-gray-700 group-hover:text-gray-900">{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const Sidebar = (props: SidebarProps) => {
  return (
    <Suspense fallback={null}>
      <SidebarInner {...props} />
    </Suspense>
  )
}

export default Sidebar
