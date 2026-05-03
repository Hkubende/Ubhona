import * as React from "react";
import { ArrowLeft, CreditCard, Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";
import type { PublicDish, PublicRestaurant } from "../../lib/storefront";
import type { StorefrontPaymentMethod } from "../../lib/storefront-payments";
import { applyDishImageFallback, getDishImageVariantUrl } from "../../lib/image-variants";

// eslint-disable-next-line react-refresh/only-export-components
export function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export function CartCheckoutTopBar({
  slug,
  itemCount,
}: {
  slug: string;
  itemCount: number;
}) {
  return (
    <div className={cn(tokens.classes.storefrontFloating, "mb-4 flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3")}>
      <Link
        to={`/r/${slug}/menu`}
        className="ubhona-storefront-control inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-primary transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Menu
      </Link>
      <div className="text-right">
        <div className="text-sm font-semibold text-text-primary">Cart Checkout</div>
        <div className="text-xs text-text-secondary/80">{itemCount} {itemCount === 1 ? "item" : "items"}</div>
      </div>
    </div>
  );
}

export function CartItemsCard({
  lines,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  lines: Array<{ dish: PublicDish; qty: number; subtotal: number }>;
  onIncrease: (dishId: string) => void;
  onDecrease: (dishId: string) => void;
  onRemove: (dishId: string) => void;
}) {
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-text-primary">Cart Review</h2>
      {lines.length === 0 ? (
        <div className="ubhona-storefront-inline-surface mt-3 rounded-xl p-4 text-sm text-text-secondary/75">Your cart is empty.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {lines.map((line) => (
            <div key={line.dish.id} className="ubhona-storefront-inline-surface rounded-2xl p-3 sm:p-4">
              <div className="flex gap-3">
                <img
                  src={getDishImageVariantUrl(line.dish.thumbUrl, "small")}
                  alt={line.dish.name}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => applyDishImageFallback(event, line.dish.thumbUrl)}
                  className="ubhona-storefront-media-frame h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="truncate font-semibold text-text-primary">{line.dish.name}</div>
                      <div className="text-xs text-text-secondary/72 line-clamp-1">{line.dish.description || "Freshly prepared"}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{formatKsh(line.subtotal)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDecrease(line.dish.id)}
                      className="ubhona-storefront-control inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-primary transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-7 text-center text-sm font-semibold text-text-primary">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => onIncrease(line.dish.id)}
                      className="ubhona-storefront-control inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-primary transition"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(line.dish.id)}
                      className="ubhona-storefront-control ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-text-secondary transition hover:border-red-400/40 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export type CheckoutOrderMode = "dine_in" | "pickup" | "delivery";

export function OrderDetailsCard(props: {
  orderMode: CheckoutOrderMode;
  onOrderModeChange: (value: CheckoutOrderMode) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  whatsappOptIn: boolean;
  onWhatsappOptInChange: (value: boolean) => void;
  whatsappNumber: string;
  onWhatsappNumberChange: (value: string) => void;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  orderNote: string;
  onOrderNoteChange: (value: string) => void;
  errors: { name?: string; phone?: string };
}) {
  const {
    orderMode,
    onOrderModeChange,
    customerName,
    onCustomerNameChange,
    customerPhone,
    onCustomerPhoneChange,
    whatsappOptIn,
    onWhatsappOptInChange,
    whatsappNumber,
    onWhatsappNumberChange,
    tableNumber,
    onTableNumberChange,
    orderNote,
    onOrderNoteChange,
    errors,
  } = props;
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-text-primary">Customer Details</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          { id: "dine_in", label: "Dine In" },
          { id: "pickup", label: "Pickup" },
          { id: "delivery", label: "Delivery" },
        ].map((option) => {
          const selected = orderMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onOrderModeChange(option.id as CheckoutOrderMode)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                selected
                  ? "border-primary/45 bg-primary/12 text-text-primary"
                  : "ubhona-storefront-inline-surface text-text-secondary hover:border-border"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        <label htmlFor="checkout-name" className={cn("block", typography.label)}>
          Customer Name
        </label>
        <Input
          id="checkout-name"
          name="checkoutName"
          autoComplete="name"
          value={customerName}
          onChange={(event) => onCustomerNameChange(event.target.value)}
          placeholder="Your name"
        />
        {errors.name ? <div className="text-xs text-red-300">{errors.name}</div> : null}
      </div>
      <div className="mt-2 space-y-2">
        <label htmlFor="checkout-phone" className={cn("block", typography.label)}>
          Phone Number
        </label>
        <Input
          id="checkout-phone"
          name="checkoutPhone"
          autoComplete="tel"
          value={customerPhone}
          onChange={(event) => onCustomerPhoneChange(event.target.value)}
          placeholder="07XXXXXXXX"
        />
        {errors.phone ? <div className="text-xs text-red-300">{errors.phone}</div> : null}
      </div>
      <div className="ubhona-storefront-inline-surface mt-3 rounded-xl p-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
          <input
            type="checkbox"
            checked={whatsappOptIn}
            onChange={(event) => onWhatsappOptInChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Send updates on WhatsApp
        </label>
        {whatsappOptIn ? (
          <div className="mt-2">
            <label htmlFor="checkout-whatsapp" className={cn("block", typography.label)}>
              WhatsApp Number
            </label>
            <Input
              id="checkout-whatsapp"
              name="checkoutWhatsapp"
              autoComplete="tel"
              value={whatsappNumber}
              onChange={(event) => onWhatsappNumberChange(event.target.value)}
              placeholder="07XXXXXXXX"
              className="mt-1.5"
            />
          </div>
        ) : null}
      </div>
      {orderMode === "dine_in" ? (
        <div className="mt-2 space-y-2">
          <label htmlFor="checkout-table" className={cn("block", typography.label)}>
            Table Number
          </label>
          <Input
            id="checkout-table"
            name="checkoutTable"
            autoComplete="off"
            value={tableNumber}
            onChange={(event) => onTableNumberChange(event.target.value)}
            placeholder="Table (optional)"
          />
        </div>
      ) : null}
      <div className="mt-2 space-y-2">
        <label htmlFor="checkout-note" className={cn("block", typography.label)}>
          Order Note
        </label>
        <Textarea
          id="checkout-note"
          name="checkoutNote"
          autoComplete="off"
          value={orderNote}
          onChange={(event) => onOrderNoteChange(event.target.value)}
          placeholder="Any prep notes (optional)"
          rows={3}
        />
      </div>
    </section>
  );
}

export function OrderSummaryCard({
  itemCount,
  subtotal,
  serviceFee,
  total,
}: {
  itemCount: number;
  subtotal: number;
  serviceFee: number;
  total: number;
}) {
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-text-primary">Order Summary</h2>
      <div className="mt-3 space-y-2 text-sm text-text-secondary/85">
        <div className="flex items-center justify-between">
          <span>Items ({itemCount})</span>
          <span>{formatKsh(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Service Fee</span>
          <span>{serviceFee > 0 ? formatKsh(serviceFee) : "Free"}</span>
        </div>
      </div>
      <div className="mt-3 border-t border-border/70 pt-3">
        <div className="flex items-end justify-between">
          <span className="text-sm text-text-secondary/80">Total</span>
          <span className="text-2xl font-semibold tracking-[-0.03em] text-primary">{formatKsh(total)}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-text-secondary/70">Estimated prep: 15-25 mins</div>
    </section>
  );
}

export function PaymentMethodCard({
  methods,
  selectedMethod,
  onMethodChange,
  manualReference,
  onManualReferenceChange,
}: {
  methods: Array<{ id: StorefrontPaymentMethod; label: string; description: string }>;
  selectedMethod: StorefrontPaymentMethod;
  onMethodChange: (id: StorefrontPaymentMethod) => void;
  manualReference: string;
  onManualReferenceChange: (value: string) => void;
}) {
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-text-primary">Payment Method</h2>
      <div className="mt-3 space-y-2">
        {methods.map((method) => {
          const selected = method.id === selectedMethod;
          return (
            <label
              key={method.id}
              className={cn(
                "block rounded-xl border px-3 py-2 transition",
                selected ? "border-primary/45 bg-primary/12" : "ubhona-storefront-inline-surface"
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="checkoutPaymentMethod"
                  checked={selected}
                  onChange={() => onMethodChange(method.id)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <div>
                  <div className="text-sm font-semibold text-text-primary">{method.label}</div>
                  <p className="mt-0.5 text-xs text-text-secondary/75">{method.description}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {selectedMethod === "manual_mpesa" ? (
        <div className="mt-3">
          <label htmlFor="manual-reference" className={cn("block", typography.label)}>
            Manual Payment Reference
          </label>
          <Input
            id="manual-reference"
            name="manualReference"
            value={manualReference}
            onChange={(event) => onManualReferenceChange(event.target.value)}
            placeholder="Optional reference code"
            className="mt-1.5"
          />
        </div>
      ) : null}
      <div className="ubhona-storefront-inline-surface mt-3 rounded-xl p-3 text-xs text-text-secondary/75">
        {selectedMethod === "stk_push"
          ? "M-Pesa prompt will be initiated after order confirmation."
          : "Manual payment will be marked as pending until confirmed by the restaurant."}
      </div>
    </section>
  );
}

export function CheckoutActionCard({
  method,
  isPlacing,
  disabled,
  paymentNotice,
  actionError,
  onPlaceOrder,
}: {
  method: StorefrontPaymentMethod;
  isPlacing: boolean;
  disabled: boolean;
  paymentNotice: string;
  actionError: string;
  onPlaceOrder: () => void;
}) {
  const ctaLabel = isPlacing
    ? "Processing..."
    : method === "stk_push"
      ? "Confirm & Pay with M-Pesa"
      : "Confirm Order (Pay Later)";
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <Button variant="primary" size="lg" onClick={onPlaceOrder} disabled={disabled} className="w-full">
        <CreditCard className="h-4 w-4" />
        {ctaLabel}
      </Button>
      {paymentNotice ? (
        <div className="mt-3 rounded-xl border border-success/30 bg-success/10 p-2.5 text-xs text-success">
          {paymentNotice}
        </div>
      ) : null}
      {actionError ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-2.5 text-xs text-red-200">
          {actionError}
        </div>
      ) : null}
    </section>
  );
}

export function MobileStickyCheckoutBar({
  total,
  itemCount,
  method,
  isPlacing,
  disabled,
  onPlaceOrder,
}: {
  total: number;
  itemCount: number;
  method: StorefrontPaymentMethod;
  isPlacing: boolean;
  disabled: boolean;
  onPlaceOrder: () => void;
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
      <div className={cn(tokens.classes.storefrontFloating, "p-3")}>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs text-text-secondary/75">{itemCount} {itemCount === 1 ? "item" : "items"}</div>
            <div className="text-base font-semibold text-primary">{formatKsh(total)}</div>
          </div>
          <Badge variant="success" className="uppercase tracking-wide">
            {method === "stk_push" ? "M-Pesa" : "Pay Later"}
          </Badge>
        </div>
        <Button variant="primary" onClick={onPlaceOrder} disabled={disabled} className="w-full">
          {isPlacing ? "Processing..." : "Confirm Order"}
        </Button>
      </div>
    </div>
  );
}

export function CheckoutSuccessPage({
  slug,
  restaurant,
  orderReference,
  orderStatus,
  paymentMethodLabel,
  paymentStatus,
  paymentReference,
  createdAt,
  customerName,
  customerPhone,
  tableNumber,
  customerNotes,
  total,
  items,
  onPrimary,
  onSecondary,
  onPrintPayment,
}: {
  slug: string;
  restaurant: PublicRestaurant;
  orderReference: string;
  orderStatus: string;
  paymentMethodLabel: string;
  paymentStatus: string;
  paymentReference: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  customerNotes?: string;
  total: number;
  items: Array<{ dishId: string; name: string; quantity: number; subtotal: number }>;
  onPrimary: () => void;
  onSecondary: () => void;
  onPrintPayment: () => void;
}) {
  const paymentPending = String(paymentStatus).toLowerCase().includes("pending");
  return (
    <div className={tokens.classes.storefrontShell}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <CartCheckoutTopBar slug={slug} itemCount={items.reduce((sum, item) => sum + item.quantity, 0)} />
        <section className={cn(tokens.classes.storefrontPanel, "p-5 sm:p-6")}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" className="uppercase tracking-wide">Order Confirmed</Badge>
            <span className="text-xs text-text-secondary/75">{restaurant.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-text-primary sm:text-3xl">Reference: {orderReference}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="ubhona-storefront-chip px-2.5 py-1 text-text-secondary/80">Status: {orderStatus}</span>
            <span className={cn(
              "rounded-full border px-2.5 py-1",
              paymentPending ? "border-primary/40 bg-primary/10 text-primary" : "border-success/40 bg-success/10 text-success"
            )}>
              Payment: {paymentStatus}
            </span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="ubhona-storefront-inline-surface rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-text-primary">Order Details</h2>
              <div className="mt-2 space-y-1 text-sm text-text-secondary/82">
                <div>Method: {paymentMethodLabel}</div>
                <div>Payment Ref: {paymentReference || "Pending"}</div>
                <div>Submitted: {new Date(createdAt).toLocaleString("en-KE")}</div>
                {customerName ? <div>Customer: {customerName}</div> : null}
                {customerPhone ? <div>Phone: {customerPhone}</div> : null}
                {tableNumber ? <div>Table: {tableNumber}</div> : null}
                {customerNotes ? <div>Note: {customerNotes}</div> : null}
              </div>
            </div>
            <div className="ubhona-storefront-inline-surface rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-text-primary">Next Step</h2>
              <p className="mt-2 text-sm text-text-secondary/82">
                {paymentPending
                  ? "Your order is confirmed and payment is pending confirmation. You can track updates from the restaurant."
                  : "Payment confirmed. Your order is now being prepared."}
              </p>
            </div>
          </div>
          <div className="ubhona-storefront-inline-surface mt-4 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-text-primary">Order Summary</h2>
            <div className="mt-2 space-y-2">
              {items.map((item) => (
                <div key={`${orderReference}-${item.dishId}`} className="flex items-center justify-between text-sm text-text-secondary/85">
                  <span>{item.quantity} x {item.name}</span>
                  <span>{formatKsh(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-border/70 pt-3 text-right text-xl font-semibold text-primary">{formatKsh(total)}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onPrimary}>Track / Home</Button>
            <Button variant="secondary" onClick={onSecondary}>Back to Menu</Button>
            <Button variant="secondary" onClick={onPrintPayment}>Print Payment Receipt</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
