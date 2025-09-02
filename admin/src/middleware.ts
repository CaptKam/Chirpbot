import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Add additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if user has admin or operator role
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return token?.role === 'ADMIN' || token?.role === 'OPERATOR' || token?.role === 'VIEWER'
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
}