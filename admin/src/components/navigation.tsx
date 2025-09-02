'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Activity, 
  Settings, 
  Users, 
  Monitor, 
  LogOut,
  Menu,
  X,
  Zap
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Alerts', href: '/dashboard/alerts', icon: AlertTriangle },
  { name: 'Games', href: '/dashboard/games', icon: Monitor },
  { name: 'Rules', href: '/dashboard/rules', icon: Settings },
  { name: 'Health', href: '/dashboard/health', icon: Activity },
  { name: 'Users', href: '/dashboard/users', icon: Users },
]

export function Navigation() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-card/50 backdrop-blur-sm border-r border-border">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">ChirpBot</h2>
                <p className="text-xs text-muted-foreground">Back Office</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon
                    className={`flex-shrink-0 w-5 h-5 mr-3 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Menu */}
          <div className="flex-shrink-0 p-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {session?.user?.name || session?.user?.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session?.user?.role || 'VIEWER'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="ml-2"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="lg:hidden">
        {/* Mobile menu button */}
        <div className="flex items-center justify-between h-16 px-4 bg-card/50 backdrop-blur-sm border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ChirpBot</h2>
              <p className="text-xs text-muted-foreground">Back Office</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex w-full max-w-xs flex-col bg-card border-r border-border">
              <div className="flex flex-col flex-1 min-h-0 pt-5 pb-4">
                <nav className="flex-1 px-4 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          isActive
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <item.icon
                          className={`flex-shrink-0 w-5 h-5 mr-3 ${
                            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                          }`}
                        />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>
                <div className="flex-shrink-0 p-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session?.user?.name || session?.user?.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session?.user?.role || 'VIEWER'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="ml-2"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}