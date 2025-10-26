# Credit Purchase Security Analysis

## Date: 2025-10-16

## Question

**Should we expose Stripe product IDs and pricing configuration to the frontend, or handle everything on the backend?**

## TL;DR Recommendation

**✅ Handle on Backend** - Follow the same abstraction pattern we just implemented for subscriptions. Frontend should receive only safe display data with abstract IDs, never actual Stripe product/price IDs.

---

## Current Subscription Pattern (Secure ✅)

### What We Just Implemented

**Frontend → Backend:**
```typescript
// Frontend sends ABSTRACT plan ID
subscriptionService.createSubscription(
  userId,
  'individual',  // ✅ Abstract ID, not Stripe product ID
  'monthly',
  token
);
```

**Backend Processing:**
```typescript
// Backend maps abstract ID to Stripe product
const planId = 'individual';

// Lookup in database via get_stripe_products_and_prices()
if (planId.startsWith('prod_')) {
  // Direct Stripe product ID (we accept but don't require)
  product = find(p => p.product_id === planId);
} else {
  // Map abstract ID to product via metadata
  product = find(p => p.product_metadata?.plan_type === planId);
}

// Use actual Stripe price ID for checkout
const priceId = prices[0].price_id;  // e.g., 'price_1RqrjHAAD812gacL...'
```

**Backend → Frontend:**
```typescript
// Backend returns ABSTRACT data
{
  planId: 'individual',        // ✅ Abstract ID
  planType: 'individual',      // From Stripe metadata
  planName: 'Individual Plan',
  monthlyCredits: 30,
  // NO Stripe product IDs exposed
}
```

### Security Benefits

✅ **Stripe Implementation Hidden**: Frontend doesn't know about `prod_SmQapVcLKm983A`
✅ **Pricing Logic Private**: Backend controls which Stripe prices are used
✅ **Environment Agnostic**: Same frontend code works with test/prod Stripe
✅ **Prevents Price Manipulation**: Frontend can't send arbitrary Stripe price IDs
✅ **Easy to Refactor**: Can change Stripe products without frontend changes

---

## Proposed Credit Package Pattern (Secure ✅)

### Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
│                                                                   │
│  GET /credit-packages                                            │
│  ─────────────────────────────────────────────────────────────  │
│  Response: {                                                     │
│    creditPackages: [                                             │
│      {                                                           │
│        id: 'pkg_25',              ← Abstract ID                  │
│        name: 'Credit Package (25)',                              │
│        creditAmount: 25,                                         │
│        price: 3.50,                                              │
│        pricePerCredit: 0.14,                                     │
│        savingsVsIndividual: 16,                                  │
│        savingsVsTeam: 7,                                         │
│        isPopular: false,                                         │
│        isBestValue: false                                        │
│      },                                                          │
│      {                                                           │
│        id: 'pkg_75',              ← Abstract ID                  │
│        name: 'Credit Package (75)',                              │
│        creditAmount: 75,                                         │
│        price: 9.00,                                              │
│        pricePerCredit: 0.12,                                     │
│        savingsVsIndividual: 28,                                  │
│        savingsVsTeam: 20,                                        │
│        isPopular: true,                                          │
│        isBestValue: false                                        │
│      },                                                          │
│      {                                                           │
│        id: 'pkg_150',             ← Abstract ID                  │
│        name: 'Credit Package (150)',                             │
│        creditAmount: 150,                                        │
│        price: 15.00,                                             │
│        pricePerCredit: 0.10,                                     │
│        savingsVsIndividual: 40,                                  │
│        savingsVsTeam: 33,                                        │
│        isPopular: false,                                         │
│        isBestValue: true                                         │
│      }                                                           │
│    ]                                                             │
│  }                                                               │
│                                                                   │
│  POST /subscriptions/purchase-credits                            │
│  ─────────────────────────────────────────────────────────────  │
│  Body: {                                                         │
│    packageId: 'pkg_75',           ← Abstract ID                  │
│    successUrl: '...',                                            │
│    cancelUrl: '...'                                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                                                                   │
│  GET /credit-packages                                            │
│  ─────────────────────────────────────────────────────────────  │
│  1. Query Stripe: stripe.products.list({                        │
│       active: true,                                              │
│       metadata: { product_type: 'credit_package' }               │
│     })                                                           │
│                                                                   │
│  2. For each product:                                            │
│     - Map prod_SmQazgSsu6blaG → 'pkg_25'  ← Generate abstract   │
│     - Extract display info from metadata                         │
│     - Get price from price_1RqrjGAAD812gacLZ8BtbNMm             │
│     - Calculate savings percentages                              │
│                                                                   │
│  3. Return sanitized DTO (no Stripe IDs)                         │
│                                                                   │
│  POST /subscriptions/purchase-credits                            │
│  ─────────────────────────────────────────────────────────────  │
│  1. Receive packageId: 'pkg_75'                                  │
│                                                                   │
│  2. Map to Stripe product:                                       │
│     pkg_75 → prod_SmQai616DcpZjP → price_1RqrjGAAD...           │
│                                                                   │
│  3. Create checkout session:                                     │
│     priceId: 'price_1RqrjGAAD812gacLZ8BtbNMm',                  │
│     quantity: 1,                  ← Always 1 for packages        │
│     metadata: {                                                  │
│       user_id: '...',                                            │
│       credit_amount: '75',        ← From product metadata        │
│       package_id: 'pkg_75',       ← Abstract ID for tracking     │
│       stripe_product_id: 'prod_SmQai616DcpZjP'  ← For audit     │
│     }                                                            │
│                                                                   │
│  4. Return { redirectUrl: session.url }                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     STRIPE WEBHOOK                               │
│                                                                   │
│  checkout.session.completed                                      │
│  ─────────────────────────────────────────────────────────────  │
│  1. Extract metadata:                                            │
│     - user_id: '...'                                             │
│     - credit_amount: '75'                                        │
│     - package_id: 'pkg_75'                                       │
│     - stripe_product_id: 'prod_SmQai616DcpZjP'                  │
│                                                                   │
│  2. Call DB function:                                            │
│     process_credit_purchase_webhook(event_data, ...)             │
│                                                                   │
│  3. Database allocates 75 credits to user                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Example

### Backend: GET /credit-packages Endpoint

```typescript
// modules/stripe-service.ts

/**
 * Get available credit packages
 * Returns abstracted data - never exposes Stripe product/price IDs
 */
export async function getCreditPackages(request: ZuploRequest, context: ZuploContext) {
  try {
    const stripeService = new StripeService(context);
    const packages = await stripeService.getCreditPackageList();

    return new Response(JSON.stringify({ creditPackages: packages }), {
      status: HttpStatusCode.OK,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    context.log.error('Error fetching credit packages:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// StripeService class
class StripeService {
  /**
   * Map Stripe product to abstract credit package DTO
   * @private
   */
  private mapToAbstractCreditPackage(product: Stripe.Product, price: Stripe.Price): CreditPackageDTO {
    const creditAmount = parseInt(product.metadata?.credit_amount || '0');
    const priceInDollars = price.unit_amount ? price.unit_amount / 100 : 0;

    return {
      id: this.generateAbstractPackageId(creditAmount),  // pkg_25, pkg_75, etc.
      name: product.name,
      description: product.description || '',
      creditAmount: creditAmount,
      price: priceInDollars,
      pricePerCredit: creditAmount > 0 ? priceInDollars / creditAmount : 0,
      savingsVsIndividual: parseInt(product.metadata?.savings_vs_individual || '0'),
      savingsVsTeam: parseInt(product.metadata?.savings_vs_team || '0'),
      isPopular: product.metadata?.popular === 'true',
      isBestValue: product.metadata?.best_value === 'true',
      marketingFeatures: product.marketing_features?.map(f => f.name) || []
    };
  }

  /**
   * Generate abstract package ID from credit amount
   * @private
   */
  private generateAbstractPackageId(creditAmount: number): string {
    return `pkg_${creditAmount}`;
  }

  /**
   * Map abstract package ID to Stripe product ID
   * @private
   */
  private async mapPackageIdToStripeProduct(packageId: string): Promise<Stripe.Product | null> {
    // Extract credit amount from abstract ID
    const match = packageId.match(/^pkg_(\d+)$/);
    if (!match) return null;

    const creditAmount = match[1];

    // Query Stripe for product with matching credit_amount
    const products = await this.stripe.products.list({
      active: true,
      limit: 100
    });

    return products.data.find(p =>
      p.metadata?.product_type === 'credit_package' &&
      p.metadata?.credit_amount === creditAmount
    ) || null;
  }

  /**
   * Get list of available credit packages
   * Returns abstracted data - never exposes Stripe IDs
   */
  async getCreditPackageList(): Promise<CreditPackageDTO[]> {
    try {
      // Fetch all credit package products from Stripe
      const products = await this.stripe.products.list({
        active: true,
        limit: 100
      });

      const creditProducts = products.data.filter(
        p => p.metadata?.product_type === 'credit_package'
      );

      // Fetch prices for each product
      const packagesWithPrices = await Promise.all(
        creditProducts.map(async (product) => {
          const prices = await this.stripe.prices.list({
            product: product.id,
            active: true,
            type: 'one_time'
          });

          const price = prices.data[0];
          if (!price) return null;

          return this.mapToAbstractCreditPackage(product, price);
        })
      );

      // Filter out null entries and sort by credit amount
      return packagesWithPrices
        .filter((pkg): pkg is CreditPackageDTO => pkg !== null)
        .sort((a, b) => a.creditAmount - b.creditAmount);
    } catch (error) {
      this.context.log.error('Error fetching credit packages from Stripe:', error);
      throw new StripeServiceError('Failed to fetch credit packages');
    }
  }
}

// DTO Type
interface CreditPackageDTO {
  id: string;                 // Abstract ID: pkg_25, pkg_75, pkg_150
  name: string;
  description: string;
  creditAmount: number;
  price: number;
  pricePerCredit: number;
  savingsVsIndividual: number;
  savingsVsTeam: number;
  isPopular: boolean;
  isBestValue: boolean;
  marketingFeatures: string[];
}
```

### Backend: POST /subscriptions/purchase-credits Endpoint

```typescript
export async function purchaseCredits(request: ZuploRequest, context: ZuploContext) {
  try {
    const { requireUserWithProfile } = await import('./auth-utils');
    const { userId } = await requireUserWithProfile(request, context);

    const body = await request.json();

    // Validate body - accept abstract package ID
    if (!body || !body.packageId || !body.successUrl || !body.cancelUrl) {
      return new Response(JSON.stringify({
        error: "Invalid parameters - required: packageId, successUrl, cancelUrl"
      }), {
        status: HttpStatusCode.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stripeService = new StripeService(context);

    // Validate user has active subscription
    const activeSubscription = await stripeService.getActiveSubscription(userId);
    if (!activeSubscription) {
      return new Response(JSON.stringify({
        error: "Active subscription required to purchase credits"
      }), {
        status: HttpStatusCode.FORBIDDEN,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create customer
    const customerId = await stripeService.getOrCreateCustomer(userId, userEmail, userName);

    // Map abstract package ID to Stripe product
    const stripeProduct = await stripeService.mapPackageIdToStripeProduct(body.packageId);
    if (!stripeProduct) {
      return new Response(JSON.stringify({
        error: `Invalid package ID: ${body.packageId}`
      }), {
        status: HttpStatusCode.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get price for the product
    const prices = await stripeService.stripe.prices.list({
      product: stripeProduct.id,
      active: true,
      type: 'one_time'
    });

    const price = prices.data[0];
    if (!price) {
      return new Response(JSON.stringify({
        error: "Price not found for package"
      }), {
        status: HttpStatusCode.INTERNAL_SERVER_ERROR,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create credit purchase session with actual Stripe IDs
    const session = await stripeService.createCheckoutSession(
      customerId,
      userId,
      {
        priceId: price.id,                                       // ✅ Actual Stripe price ID
        mode: 'payment',
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        metadata: {
          user_id: userId,
          credit_amount: stripeProduct.metadata.credit_amount,  // From Stripe metadata
          package_id: body.packageId,                           // Abstract ID for tracking
          stripe_product_id: stripeProduct.id,                  // For audit/debugging
          credit_purchase: 'true'
        },
        quantity: 1                                              // ✅ Always 1 for packages
      }
    );

    return new Response(JSON.stringify({ redirectUrl: session.url }), {
      status: HttpStatusCode.OK,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    context.log.error('Error in purchaseCredits:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Frontend: Fetching Credit Packages

```typescript
// services/SubscriptionService.ts

async getCreditPackages(): Promise<CreditPackage[]> {
  if (!this.ensureApiAvailable('getCreditPackages', [])) {
    return [];
  }

  try {
    const response = await api.get('/credit-packages');
    return response.data?.creditPackages || [];
  } catch (error) {
    logger.error('SubscriptionService: getCreditPackages - Error:', error);
    return [];
  }
}

async purchaseCredits(
  userId: string,
  packageId: string,  // ✅ Abstract ID: 'pkg_75'
  token: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<{ redirectUrl: string }> {
  this.ensureAuthenticated(userId, token, 'purchaseCredits');

  if (!this.ensureApiAvailable('purchaseCredits', null)) {
    throw new Error('API service is unavailable');
  }

  try {
    const headers = await this.createStandardHeaders(token, userId);

    const response = await api.post('/subscriptions/purchase-credits', {
      packageId,      // ✅ Send abstract ID, not Stripe product ID
      successUrl,
      cancelUrl
    }, { headers });

    return response.data;
  } catch (error) {
    logger.error('SubscriptionService: purchaseCredits - Error:', error);
    throw error;
  }
}
```

### Frontend: Updated CreditPurchase Component

```typescript
// components/subscription/CreditPurchase.tsx

const CreditPurchase: React.FC = () => {
  const { t } = useTranslation(['subscription', 'common']);
  const { getToken } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [creditPackages, setCreditPackages] = React.useState<CreditPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Fetch credit packages from API on mount
  React.useEffect(() => {
    const fetchPackages = async () => {
      try {
        const packages = await subscriptionService.getCreditPackages();
        setCreditPackages(packages);

        // Pre-select popular package
        const popularPkg = packages.find(p => p.isPopular);
        if (popularPkg) {
          setSelectedPackageId(popularPkg.id);
        }
      } catch (error) {
        logger.error('Error fetching credit packages:', error);
        toast({
          title: t('error.fetchFailed'),
          description: 'Failed to load credit packages',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async () => {
    if (!user?.id || !getToken || !selectedPackageId) return;

    setIsProcessing(true);
    try {
      const token = await getToken();
      if (!token) return;

      const { successUrl, cancelUrl } = subscriptionService.generateCreditPurchaseUrls();

      // Purchase credits with abstract package ID
      const result = await subscriptionService.purchaseCredits(
        user.id,
        selectedPackageId,  // ✅ Abstract ID: 'pkg_75'
        token,
        successUrl,
        cancelUrl
      );

      // Redirect to Stripe checkout
      if (result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      logger.error('Error purchasing credits:', error);
      toast({
        title: t('error.purchaseFailed'),
        description: error instanceof Error ? error.message : 'Failed to purchase credits',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div>Loading credit packages...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('credits.purchase.title')}</CardTitle>
        <CardDescription>{t('credits.purchase.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedPackageId || ''}
          onValueChange={setSelectedPackageId}
          className="space-y-4"
        >
          {creditPackages.map(pkg => (
            <CreditPackageCard
              key={pkg.id}
              creditPackage={pkg}
              selected={selectedPackageId === pkg.id}
              onSelect={() => setSelectedPackageId(pkg.id)}
            />
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handlePurchase}
          disabled={isProcessing || !selectedPackageId}
        >
          {isProcessing ? 'Processing...' : t('credits.purchase.button')}
        </Button>
      </CardFooter>
    </Card>
  );
};
```

---

## Security Comparison

### ❌ If We Expose Stripe IDs to Frontend

**Risks:**
1. **Price Manipulation**: Malicious users could send arbitrary Stripe price IDs
2. **Environment Leakage**: Frontend exposes test vs production mode
3. **Implementation Details**: Reveals internal Stripe product structure
4. **Tight Coupling**: Frontend breaks if Stripe products change
5. **Testing Complexity**: Need to mock Stripe product IDs in frontend tests

**Example Attack:**
```typescript
// Malicious user inspects network traffic
// Sees: priceId: 'price_1RqrjGAAD812gacL...' for 75 credits at $9.00

// Attacker modifies request to use 150 credit price with 75 credit expectation
fetch('/subscriptions/purchase-credits', {
  body: JSON.stringify({
    priceId: 'price_1RqrjFAAD812gacL...',  // 150 credit price
    amount: 75                              // Expects 75 credits
  })
});

// If backend trusts frontend, user gets 150 credits for $9 instead of $15
```

### ✅ If We Abstract Stripe IDs (Recommended)

**Benefits:**
1. **Backend Controls Pricing**: Frontend cannot manipulate which Stripe price is used
2. **Environment Agnostic**: Same frontend code for test/prod
3. **Easy Refactoring**: Change Stripe products without touching frontend
4. **Clear Contracts**: Frontend sends business intent, backend handles implementation
5. **Better Testing**: Frontend tests use abstract IDs, no Stripe mocking needed

**Security Flow:**
```typescript
// User selects package in UI
selectedPackageId = 'pkg_75';  // Abstract ID

// Frontend sends intent
POST /subscriptions/purchase-credits
{ packageId: 'pkg_75' }

// Backend validates and maps
- Validate user has subscription ✅
- Map pkg_75 → prod_SmQai616DcpZjP ✅
- Find price for product → price_1RqrjGAAD... ✅
- Verify price is active ✅
- Create checkout with actual Stripe IDs ✅

// No opportunity for manipulation
```

---

## What Information is Safe to Expose?

### ✅ Safe to Send to Frontend

| Data | Example | Reason |
|------|---------|--------|
| Abstract Package ID | `'pkg_75'` | Not a Stripe ID, backend controlled |
| Package Name | `'Credit Package (75)'` | Display text, no security risk |
| Credit Amount | `75` | Public information |
| Display Price | `9.00` | Public pricing, users see this anyway |
| Price Per Credit | `0.12` | Calculated from public data |
| Savings Percentage | `28%` | Marketing information |
| Popular/Best Value flags | `true/false` | Display hints |
| Marketing Features | `['Popular choice', ...]` | Display text |

### ❌ Never Send to Frontend

| Data | Example | Reason |
|------|---------|--------|
| Stripe Product ID | `'prod_SmQai616DcpZjP'` | Internal implementation detail |
| Stripe Price ID | `'price_1RqrjGAAD812gacL...'` | Could be used for manipulation |
| Stripe Customer ID | `'cus_...'` | Sensitive Stripe data |
| Price in Cents | `900` | Use dollars for display |
| Stripe Mode | `'test' / 'live'` | Reveals environment |
| Internal Metadata | `{ product_type: 'credit_package' }` | Implementation detail |

---

## Recommendation Summary

### ✅ DO THIS (Secure Pattern)

1. **Backend** exposes `/credit-packages` endpoint
   - Returns abstract DTOs with `id: 'pkg_25'`, `'pkg_75'`, `'pkg_150'`
   - Never includes Stripe product/price IDs

2. **Frontend** fetches and displays packages
   - Shows abstract IDs to user
   - Sends selected `packageId` to backend

3. **Backend** maps abstract → Stripe
   - `pkg_75` → `prod_SmQai616DcpZjP` → `price_1RqrjGAAD...`
   - Creates checkout with actual Stripe IDs
   - Validates user permissions

4. **Stripe** processes payment
   - Webhook contains metadata with abstract ID for tracking
   - Database function allocates credits

### ❌ DON'T DO THIS (Insecure Pattern)

1. ~~Frontend hardcodes credit packages with prices~~
2. ~~Frontend sends credit amount, backend calculates price~~
3. ~~Backend exposes Stripe product IDs in API responses~~
4. ~~Frontend sends Stripe price IDs directly~~

---

## Implementation Priority

### Phase 1: Security Foundation (MUST DO FIRST)
1. Create abstract ID mapping system
2. Implement `/credit-packages` endpoint with abstract DTOs
3. Update `purchaseCredits()` to accept abstract package IDs
4. Add validation and mapping logic

### Phase 2: Frontend Integration
1. Remove hardcoded credit packages
2. Fetch packages from API
3. Update UI to use abstract IDs
4. Test full flow

### Phase 3: Monitoring
1. Log abstract ID → Stripe ID mappings
2. Monitor for invalid package ID attempts
3. Alert on pricing mismatches

---

## Conclusion

**Follow the subscription pattern we just implemented** - abstract Stripe implementation details from the frontend.

**Key Principles:**
1. Frontend sends **business intent** (which package user wants)
2. Backend handles **implementation** (which Stripe products/prices to use)
3. Never expose **internal identifiers** (Stripe product/price IDs)
4. Always validate **user permissions** (active subscription required)

This approach provides:
- ✅ Better security
- ✅ Easier maintenance
- ✅ Environment independence
- ✅ Flexibility to change Stripe configuration

**Estimated Implementation Time:** 4-6 hours to build secure abstraction layer
