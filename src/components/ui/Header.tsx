"use client";

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Menu, X, User, ChevronDown, Database, BarChart3, PieChart, Globe, MessageSquare, Upload, Sun, Moon, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnv } from '@/lib/env'
import { useThemeMode } from '@/app/providers'
import Sidebar from './Sidebar'

const HeaderInner = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isServicesOpen, setIsServicesOpen] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const { mode, toggleMode } = useThemeMode()
  
  const searchParams = useSearchParams()
  const withParams = (path: string) => `${path}?${searchParams.toString()}`

  useEffect(() => {
    try {
      const env = getPublicEnv()
      const supabase = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null)
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
      })
      return () => subscription.unsubscribe()
    } catch (e) {
      // Ignore on SSR
    }
  }, [])

  async function handleLogout() {
    try {
      const env = getPublicEnv()
      const supabase = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      await supabase.auth.signOut()
      await fetch('/auth/signout', { method: 'POST' })
    } catch (e) {
      // Ignore
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <>
      <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4 ml-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link href="/" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/5e4a8a19-f7b5-4e29-89a9-ad9d693b6111.png"
                  alt="TallyOne Ai"
                  className="dark:brightness-0 dark:invert"
                  style={{ width: 180, height: 52, objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
              </Link>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-primary transition-colors">Home</Link>
              <div className="relative"
                onMouseEnter={() => setIsServicesOpen(true)}
                onMouseLeave={() => setIsServicesOpen(false)}
              >
                <button className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary transition-colors">
                  Services
                  <ChevronDown className="ml-1 w-4 h-4" />
                </button>
                <AnimatePresence>
                  {isServicesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 w-[500px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 z-50"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <Link href={withParams('/dashboard')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Local Tally Sync</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Connect with your local Tally database</p>
                            </div>
                          </div>
                        </Link>
                        <Link href={withParams('/dashboard/funds-flow')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                              <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Funds Flow Statement</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Management Report & Funds Utilization</p>
                            </div>
                          </div>
                        </Link>
                        <Link href={withParams('/dashboard/trial-balance')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                              <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Trial Balance (MIS)</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Automated balance sheets & trial balances</p>
                            </div>
                          </div>
                        </Link>
                        <Link href={withParams('/dashboard')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                              <Globe className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Email Triggers</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Automate ledger & outstanding email triggers</p>
                            </div>
                          </div>
                        </Link>
                        <Link href="/dashboard" className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900/40 rounded-lg flex items-center justify-center">
                              <MessageSquare className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">AI Financial Chat</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Query Tally books in natural language</p>
                            </div>
                          </div>
                        </Link>
                        <Link href="/dashboard" className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg flex items-center justify-center">
                              <Upload className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Read & Write Sync</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Read/write vouchers from a single platform</p>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="relative"
                onMouseEnter={() => setIsReportsOpen(true)}
                onMouseLeave={() => setIsReportsOpen(false)}
              >
                <button className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary transition-colors">
                  Reports
                  <ChevronDown className="ml-1 w-4 h-4" />
                </button>
                <AnimatePresence>
                  {isReportsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 w-[400px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 z-50"
                    >
                      <div className="flex flex-col gap-4">
                        <Link href={withParams('/dashboard/trial-balance')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                              <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Trial Balance (MIS)</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Automated balance sheets & trial balances</p>
                            </div>
                          </div>
                        </Link>
                        <Link href={withParams('/dashboard/tds-report')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">TDS Compliance Report</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Liability clearance & chronological FIFO audit</p>
                            </div>
                          </div>
                        </Link>
                        <Link href={withParams('/dashboard/funds-flow')} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                              <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Funds Flow Statement</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Management Report & Funds Utilization</p>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            <div className="flex items-center space-x-3">
              {/* Dark Mode Switch Button */}
              <button
                onClick={toggleMode}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle dark mode"
              >
                {mode === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="hidden md:flex items-center space-x-3">
                {user ? (
                  <>
                    <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:text-primary transition-colors">Login</Link>
                    <Link href="/register" className="btn-primary">Sign Up</Link>
                  </>
                )}
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  )
}

const Header = () => {
  return (
    <Suspense fallback={<header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 h-16 sticky top-0 z-40" />}>
      <HeaderInner />
    </Suspense>
  )
}

export default Header
