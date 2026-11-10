import { useEffect, useRef, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ClerkProvider, Show, useClerk } from '@clerk/react'
import { publishableKeyFromHost } from '@clerk/react/internal'
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter'
import { ErrorBoundary } from '@/components/error-boundary'
import { BackgroundDecor } from '@/components/BackgroundDecor'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { UtilityBar } from '@/components/UtilityBar'
import brandLogo from '@/assets/logo.png'
import HomePage from '@/pages/HomePage'
import InventoryPage from '@/pages/InventoryPage'
import AccountPage from '@/pages/AccountPage'
import SecurityPage from '@/pages/SecurityPage'
import { SignInPage, SignUpPage } from '@/pages/AuthPages'
import NotFound from '@/pages/not-found'

const queryClient = new QueryClient()

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
)

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file')
}

const clerkAppearance = {
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: new URL(brandLogo, window.location.origin).href,
  },
  variables: {
    colorPrimary: '#0070bb',
    colorForeground: '#172235',
    colorMutedForeground: '#475569',
    colorDanger: '#b42318',
    colorBackground: '#fdfcf8',
    colorInput: '#ffffff',
    colorInputForeground: '#172235',
    colorNeutral: '#172235',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-canvas rounded-[1.5rem] w-[440px] max-w-full overflow-hidden border border-brand-blue/15 shadow-lift',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-2xl font-black text-ink',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButtonText: 'text-ink font-semibold',
    formFieldLabel: 'text-ink font-semibold',
    footerActionLink: 'text-brand-blue font-semibold',
    footerActionText: 'text-slate-600',
    dividerText: 'text-slate-500',
    identityPreviewEditButton: 'text-brand-blue',
    formFieldSuccessText: 'text-emerald-800',
    alertText: 'text-ink',
    logoBox: 'h-14 justify-center',
    logoImage: 'h-14 w-auto',
    socialButtonsBlockButton: 'border border-slate-300 bg-white',
    formButtonPrimary: 'bg-brand-blue text-white rounded-full font-semibold shadow-cta',
    formFieldInput: 'bg-white border border-slate-300 text-ink',
    footerAction: 'justify-center',
    dividerLine: 'bg-slate-200',
    alert: 'bg-brand-mist border border-brand-blue/20',
    otpCodeFieldInput: 'border border-slate-300 text-ink',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk()
  const qc = useQueryClient()
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear()
      }
      prevUserIdRef.current = userId
    })
    return unsubscribe
  }, [addListener, qc])

  return null
}

function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  )
}

function Routes() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/account">
          <Protected><AccountPage /></Protected>
        </Route>
        <Route path="/account/security/*?">
          <Protected><SecurityPage /></Protected>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  )
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation()

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign in to Woody's Paper",
            subtitle: 'Your website account for pricing benefits and order history',
          },
        },
        signUp: {
          start: {
            title: "Create your Woody's Paper account",
            subtitle: "We'll verify your email before your account is active",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <div id="top" className="relative text-slate-800">
          <BackgroundDecor />
          <UtilityBar />
          <Header />
          <main className="relative z-10 pt-chrome lg:pt-chrome-lg">
            <Routes />
          </main>
          <Footer />
        </div>
      </QueryClientProvider>
    </ClerkProvider>
  )
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  )
}

export default App
