"use client";

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Play, FileText, Database, BarChart3, Upload, ArrowUpCircle } from 'lucide-react'
import { DottedSurface } from '@/components/ui/dotted-surface'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'

export default function LandingPage() {
  const [displayText, setDisplayText] = useState('')
  const fullText = 'TallyOne Ai'
  
  useEffect(() => {
    const typeText = () => {
      let index = 0
      const typingTimer = setInterval(() => {
        if (index <= fullText.length) {
          setDisplayText(fullText.slice(0, index))
          index++
        } else {
          clearInterval(typingTimer)
        }
      }, 120)
    }
    
    typeText()
    const loopTimer = setInterval(typeText, 5000)
    
    return () => clearInterval(loopTimer)
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-inter">
      <Header />
      
      <main className="flex-grow">
        <section className="relative pt-20 pb-32 overflow-hidden bg-white min-h-screen">
          <div className="absolute inset-0 overflow-hidden">
            <DottedSurface className="!absolute !inset-0 !-z-1" />
          </div>
          
          <div className="container relative z-20 max-w-7xl mx-auto px-6 md:px-8 flex flex-col items-center text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-xs mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
              The AI Tally Assistant
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="max-w-4xl text-4xl md:text-6xl font-bold text-slate-900 leading-[1.05] mb-5" style={{ fontFamily: 'Google Sans, sans-serif' }}>
              <span className="transition-all duration-100">{displayText}</span><br /><span>Your All-in-One Tally Workspace</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="max-w-2xl text-lg text-slate-500 font-medium leading-relaxed mb-8">
                Instantly connect the installed app, enable MSI reporting, email triggering, and AI‑powered dashboard with zero manual work.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-3 mb-16">
              <Link href="/register" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-primary hover:bg-primary/90 rounded-full shadow-xl shadow-primary/20 transition-all hover:-translate-y-1">
                Start for Free<ArrowRight className="ml-2" size={18} />
              </Link>
              <button className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-full shadow-sm transition-all hover:-translate-y-1">
                <Play className="mr-2" size={14} />Watch Demo
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="relative w-full max-w-6xl mx-auto mt-16">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-2xl opacity-20" />
              <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden aspect-[16/9]">
                <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="ml-4 flex-1 flex justify-center">
                    <div className="px-4 py-1 bg-white rounded-md text-xs text-slate-400 border border-slate-200 w-64 text-center">tallyone.ai/dashboard</div>
                  </div>
                </div>
                <div className="p-8 bg-slate-50/50 h-full grid grid-cols-12 gap-6 text-left">
                  <div className="hidden md:block col-span-2 bg-white rounded-xl border border-slate-200 h-full p-4 space-y-4">
                    <div className="h-8 w-8 bg-primary rounded-lg mb-8" />
                    {[1,2,3,4,5].map(i => <div key={i} className="h-2 w-full bg-slate-100 rounded-full" />)}
                  </div>
                  <div className="col-span-12 md:col-span-10 grid grid-cols-3 gap-6">
                    {[1,2,3].map(i => (
                      <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="h-8 w-8 bg-blue-50 rounded-lg mb-4" />
                        <div className="h-6 w-24 bg-slate-100 rounded-full mb-2" />
                        <div className="h-4 w-16 bg-slate-50 rounded-full" />
                      </div>
                    ))}
                    <div className="col-span-3 md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-64 flex items-end justify-between gap-4">
                      {[40,70,45,90,65,85,55,80,60,95].map((h,i) => <div key={i} className="w-full bg-primary/90 rounded-t-sm" style={{height:`${h}%`,opacity:0.6+i*0.04}} />)}
                    </div>
                    <div className="col-span-3 md:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-64">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-sm font-medium text-slate-600">AI Analysis</div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-2 w-full bg-slate-100 rounded-full" />
                        <div className="h-2 w-5/6 bg-slate-100 rounded-full" />
                        <div className="h-2 w-4/6 bg-slate-100 rounded-full" />
                      </div>
                      <div className="mt-8 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">"Growth is projected to increase by 24% next quarter."</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <div className="w-full mt-32 pb-24">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-extrabold text-slate-900 mb-3">Connect Tally, ask questions</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">Ask questions in natural language and TallyOne Ai analyzes your financial data instantly</p>
              </div>

              <div className="container mx-auto px-4 md:px-0 text-left">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">

                  {/* CARD 1 */}
                  <div className="bg-[#F3F7FB] rounded-3xl p-6 shadow-sm border border-slate-100 group">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-50/70 border border-blue-100 text-blue-700 font-medium mb-4">
                      1
                    </div>

                    <div className="relative w-full h-48 bg-[#F3F7FB] rounded-2xl overflow-visible flex items-center justify-center">
                      {/* First spreadsheet - rotated left */}
                      <div className="absolute left-1/2 top-1/2 w-[220px] h-[150px] bg-white rounded-lg shadow-lg border border-slate-200 transition-all duration-500 -rotate-[3deg] group-hover:-rotate-[12deg] group-hover:-translate-x-8" style={{ marginLeft: '-110px', marginTop: '-75px' }}>
                        <div className="w-full h-full overflow-hidden">
                          <table className="w-full h-full border-collapse text-[6px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">ID</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Name</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Age</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">City</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Sales</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...Array(12)].map((_, i) => (
                                <tr key={i} className="h-3">
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Second spreadsheet - rotated right */}
                      <div className="absolute left-1/2 top-1/2 w-[220px] h-[150px] bg-white rounded-lg shadow-lg border border-slate-200 transition-all duration-500 rotate-[3deg] group-hover:rotate-[12deg] group-hover:translate-x-8" style={{ marginLeft: '-110px', marginTop: '-75px' }}>
                        <div className="w-full h-full overflow-hidden">
                          <table className="w-full h-full border-collapse text-[6px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Code</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Product</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Stock</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Category</th>
                                <th className="border border-slate-200 font-semibold p-0.5 h-4">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...Array(12)].map((_, i) => (
                                <tr key={i} className="h-3">
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                  <td className="border border-slate-200 bg-white p-0.5"></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Excel icon - top left */}
                      <div className="absolute left-4 top-4 w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-md z-10 transition-transform duration-500 group-hover:-translate-y-2 group-hover:-translate-x-2">
                        <img src="/src/assets/excel.png" alt="Excel" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>

                      {/* XLSX label - top center */}
                      <div className="absolute left-[100px] top-4 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-md z-10 transition-transform duration-500 group-hover:-translate-y-3">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                            <path d="M14 2v6h6" fill="white"/>
                          </svg>
                          <span className="text-xs font-medium text-slate-700">XLSX</span>
                        </div>
                      </div>

                      {/* Google Drive icon - top right */}
                      <div className="absolute right-8 top-8 w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-md z-10 transition-transform duration-500 group-hover:-translate-y-2 group-hover:translate-x-2">
                        <img src="/src/assets/google-drive.png" alt="Google Drive" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>

                      {/* CSV icon - bottom left */}
                      <div className="absolute left-4 bottom-8 w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-md z-10 transition-transform duration-500 group-hover:translate-y-2 group-hover:-translate-x-2">
                        <img src="/src/assets/csv.png" alt="CSV" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>

                      {/* PDF label - bottom center */}
                      <div className="absolute left-[140px] bottom-4 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-md z-10 transition-transform duration-500 group-hover:translate-y-3">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                            <path d="M14 2v6h6" fill="white"/>
                          </svg>
                          <span className="text-xs font-medium text-slate-700">PDF</span>
                        </div>
                      </div>

                      {/* Google Sheets icon - bottom right */}
                      <div className="absolute right-8 bottom-8 w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-md z-10 transition-transform duration-500 group-hover:translate-y-2 group-hover:translate-x-2">
                        <img src="/src/assets/google-sheets.png" alt="Google Sheets" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-slate-900 mt-6">
                      Universal Tally connection
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Link Tally locally or from remote cloud servers with read/write access
                    </p>
                  </div>

                  {/* CARD 2 */}
                  <div className="bg-[#F3F7FB] rounded-3xl p-6 shadow-sm border border-slate-100 group">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-50/70 border border-blue-100 text-blue-700 font-medium mb-4">
                      2
                    </div>

                    <div className="w-full h-48 bg-[#F3F7FB] rounded-2xl flex items-center justify-center">
                      <div className="w-72 bg-white rounded-xl p-5 shadow-md border border-slate-100 text-left text-slate-700 relative transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-xl">
                        <div className="text-base leading-relaxed">
                          What is our net movement <br />  this month ?
                        </div>

                        <div className="absolute right-4 bottom-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-90">
                          <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center shadow">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-slate-900 mt-6">
                      Ask for financial analysis
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      You provide the queries, our AI handles ledger and voucher analysis
                    </p>
                  </div>

                  {/* CARD 3 */}
                  <div className="bg-[#F3F7FB] rounded-3xl p-6 shadow-sm border border-slate-100 group">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-50/70 border border-blue-100 text-blue-700 font-medium mb-4">
                      3
                    </div>

                    <div className="relative w-full h-48 bg-[#F3F7FB] rounded-2xl overflow-hidden flex items-center justify-center">
                      {/* stacked/rotated charts using uploaded chart images */}
                      <img src="/boxplots.webp" alt="chart-1" className="absolute left-12 top-6 w-44 rounded-lg shadow-md transform -rotate-6 transition-transform duration-500 group-hover:-rotate-12 group-hover:translate-x-[-10px]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <img src="/heatmap.webp" alt="chart-2" className="absolute left-40 top-10 w-44 rounded-lg shadow-md transform rotate-2 transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <img src="/bar-chart.webp" alt="chart-3" className="absolute right-12 top-16 w-44 rounded-lg shadow-md transform rotate-6 transition-transform duration-500 group-hover:rotate-12 group-hover:translate-x-[10px]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>

                    <h3 className="text-xl font-semibold text-slate-900 mt-6">
                      Get automated MIS reports
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Generate balance sheets, trial balances, or custom ledger reports
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-center mt-16">
                <Link href="/register" className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-full hover:bg-blue-700 transition shadow-md">
                  Get started for free<ArrowRight className="ml-2" size={20} />
                </Link>
              </div>
            </div>
            
            <div className="w-full mt-20 pb-32">
              <div className="text-center mb-16">
                <h2 className="text-5xl font-bold text-slate-900 mb-4">Chat with TallyOne Ai</h2>
                <p className="text-xl text-slate-500 max-w-3xl mx-auto">From ledgers to custom vouchers, ask questions in natural language and get instant financial insights.</p>
              </div>
              <div className="relative w-full max-w-6xl mx-auto">
                <div className="relative bg-gradient-to-br from-cyan-100 via-blue-100 to-blue-200 rounded-3xl p-8 shadow-2xl min-h-[600px]">
                  
                  {/* User Question Card - Top Left */}
                  <div className="absolute left-8 top-8 bg-white rounded-2xl p-6 shadow-lg max-w-md text-left">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white font-semibold text-sm">P</div>
                      <span className="text-slate-500 text-sm">You</span>
                    </div>
                    <p className="text-slate-880 text-base mb-4">List all vouchers in April with amounts greater than 10,000 INR</p>
                    <div className="flex gap-3 text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                  </div>

                  {/* Middle Chart - Top Right */}
                  <div className="absolute right-8 top-4 w-[380px]">
                    <img src="/src/assets/middle-chart.png" alt="Middle Chart" className="w-full rounded-2xl shadow-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>

                  {/* Chart Result - Below User Card */}
                  <div className="absolute left-8 bottom-8 w-[650px]">
                    <img src="/src/assets/chart-result.png" alt="Chart Result" className="w-full rounded-2xl shadow-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>

                </div>
              </div>
            </div>

            <div className="w-full mt-20 pb-32">
              <div className="text-center mb-16">
                <h2 className="text-5xl font-bold text-slate-900 mb-4">Automated MIS & Email Triggers</h2>
                <p className="text-xl text-slate-500 max-w-3xl mx-auto">Set up email triggering systems to automatically dispatch daily ledger updates, outstanding invoices, and MIS reports to management.</p>
              </div>
              <div className="relative w-full max-w-6xl mx-auto">
                <div className="relative bg-gradient-to-br from-cyan-100 via-blue-100 to-blue-200 rounded-3xl p-8 shadow-2xl min-h-[600px]">
                  <div className="absolute top-8 right-8 flex gap-4">
                    <img src="/src/assets/gmail.png" alt="Gmail" className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  
                  {/* 3D Report Photos Section */}
                  <div className="relative flex items-center justify-center h-[350px] mt-20" style={{ perspective: '1000px' }}>
                    {/* Left Report */}
                    <div className="absolute left-8 z-10 group cursor-pointer">
                      <img 
                        src="/src/assets/report-2.jpg" 
                        alt="Report 2" 
                        className="w-80 h-96 object-cover rounded-xl shadow-lg transition-all duration-700" 
                        style={{
                          transform: 'rotateY(-15deg)',
                          transformStyle: 'preserve-3d',
                          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.15))'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'rotateY(-25deg) scale(1.1) translateZ(20px)';
                          e.currentTarget.style.filter = 'drop-shadow(0 35px 70px rgba(0,0,0,0.25))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'rotateY(-15deg)';
                          e.currentTarget.style.filter = 'drop-shadow(0 25px 50px rgba(0,0,0,0.15))';
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    
                    {/* Middle Report - Larger */}
                    <div className="relative z-20 group cursor-pointer">
                      <img 
                        src="/src/assets/report-1.jpg" 
                        alt="Report 1" 
                        className="w-96 h-[450px] object-cover rounded-xl shadow-2xl transition-all duration-700" 
                        style={{
                          transformStyle: 'preserve-3d',
                          filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.25))'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05) translateZ(30px)';
                          e.currentTarget.style.filter = 'drop-shadow(0 40px 80px rgba(0,0,0,0.35))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.filter = 'drop-shadow(0 30px 60px rgba(0,0,0,0.25))';
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    
                    {/* Right Report */}
                    <div className="absolute right-8 z-10 group cursor-pointer">
                      <img 
                        src="/src/assets/report-3.jpg" 
                        alt="Report 3" 
                        className="w-80 h-96 object-cover rounded-xl shadow-lg transition-all duration-700" 
                        style={{
                          transform: 'rotateY(15deg)',
                          transformStyle: 'preserve-3d',
                          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.15))'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'rotateY(25deg) scale(1.1) translateZ(20px)';
                          e.currentTarget.style.filter = 'drop-shadow(0 35px 70px rgba(0,0,0,0.25))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'rotateY(15deg)';
                          e.currentTarget.style.filter = 'drop-shadow(0 25px 50px rgba(0,0,0,0.15))';
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
