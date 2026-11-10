import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter'
import { ErrorBoundary } from '@/components/error-boundary'
import { BackgroundDecor } from '@/components/BackgroundDecor'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { UtilityBar } from '@/components/UtilityBar'
import HomePage from '@/pages/HomePage'
import InventoryPage from '@/pages/InventoryPage'
import NotFound from '@/pages/not-found'

const queryClient = new QueryClient()

function Routes() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  )
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <div id="top" className="relative text-slate-800">
          <BackgroundDecor />
          <UtilityBar />
          <Header />
          <main className="relative z-10 pt-chrome lg:pt-chrome-lg">
            <Routes />
          </main>
          <Footer />
        </div>
      </WouterRouter>
    </QueryClientProvider>
  )
}

export default App
