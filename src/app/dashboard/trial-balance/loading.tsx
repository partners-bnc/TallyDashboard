import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import styles from '@/components/trial-balance.module.css'

export default function Loading() { return <div className="min-h-screen bg-background flex flex-col justify-between"><Header /><main className="flex-grow"><div className={styles.shell}><div className={styles.state}>Loading Trial Balance…</div></div></main><Footer /></div> }
