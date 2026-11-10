import { AccountPrompt } from './AccountPrompt'
import { CatalogProducts } from './CatalogProducts'
import { LightSpeedStore } from './LightSpeedStore'
import { Reveal } from './Reveal'

type InventorySectionProps = {
  /** Opens this search in the storefront after the hub page loads. */
  initialQuery?: string
  /** Opens the store's account page (sign-in form when signed out). */
  openAccount?: boolean
  /** Front-window mode: clicks, searches and sign-in open on this page instead. */
  hubPath?: string
}

export function InventorySection({ initialQuery = '', openAccount = false, hubPath }: InventorySectionProps) {
  return (
    <Reveal as="section" id="products" className="scroll-mt-chrome px-4 py-12 sm:py-20 lg:scroll-mt-chrome-lg">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">Inventory</h2>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-brand-blue sm:w-20" />
          <AccountPrompt />
        </div>

        {openAccount ? (
          <LightSpeedStore
            productsPerPage={30}
            initialQuery={initialQuery}
            openAccount
            defaultCategoryId={0}
            design={{
              productListCardSpacingType: 'wide',
              product_list_category_title_behavior: 'SHOW_BELOW_IMAGE',
            }}
          />
        ) : (
          <>
            <CatalogProducts initialQuery={initialQuery} hubPath={hubPath} />
            <details className="mx-auto mt-12 max-w-4xl rounded-panel border border-slate-200 bg-white p-5 shadow-glass">
              <summary className="cursor-pointer font-semibold text-brand-blue">
                Open the existing Lightspeed store
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Use the current store for shopping cart, checkout, and customer account features.
                Product cards above link to the provider’s product pages.
              </p>
              <LightSpeedStore
                productsPerPage={30}
                showSearch={false}
                defaultCategoryId={0}
                design={{
                  productListCardSpacingType: 'wide',
                  product_list_category_title_behavior: 'SHOW_BELOW_IMAGE',
                }}
              />
            </details>
          </>
        )}
      </div>
    </Reveal>
  )
}
