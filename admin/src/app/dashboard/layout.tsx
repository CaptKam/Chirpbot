import { Navigation } from '@/components/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <Navigation />
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}