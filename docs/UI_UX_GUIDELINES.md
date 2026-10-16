# ROLLZ POS — UI/UX Guidelines

## Brand
- Brand name: ROLLZ
- Use the provided ROLLZ logo.
- Save the logo as `client/public/rollz-logo.png` when adding it to the repository.
- Brand colors should be sampled from the actual logo. Approximate direction: bright blue/cyan as primary, red as accent, black for contrast, white/light gray for the working background.
- Keep the application professional, high-contrast, and readable in a busy restaurant.

## POS principles
- Optimize for speed and minimum clicks.
- Make item names and prices easy to scan.
- Use large touch-friendly buttons even though the first setup uses one computer.
- Keep the cart and total visible at all times.
- Use clear disabled, loading, error, success, and unavailable states.
- Keyboard shortcuts may be added, but must be discoverable and must not trigger dangerous actions accidentally.
- Confirm destructive actions such as voiding an order or issuing a refund.
- Never show a successful payment or print status until the backend confirms it.

## Main screens
1. Login / first-run owner setup
2. POS billing
3. Payment confirmation
4. Receipt preview / print status
5. Menu and category management
6. Modifier management
7. Order history and reprint
8. Cash session open/close
9. Dashboard and reports
10. Restaurant settings
11. User management
12. Inventory (later phase)

## POS layout
- Category navigation on the left.
- Product cards/grid in the center.
- Current cart, modifiers, totals, and checkout on the right.
- Include quick search.
- Show order type clearly.
- Show modifier choices before adding the item when required.
- Show subtotal, discount, tax breakdown, and final total.
- Make the Pay button prominent but protect against double submission.
- Display an unmistakable state when payment is pending, confirmed, or failed.

## Kitchen ticket
- Large, legible type.
- Order number at the top.
- Order type and timestamp.
- Items and quantities prominently.
- Modifiers and special instructions indented beneath the item.
- Avoid unnecessary payment data.
- Reprints should be marked clearly.

## Receipt
- ROLLZ logo/name and configured restaurant details.
- Invoice number, date/time, cashier, and order type.
- Item names, quantity, unit price, line total.
- Discount and tax breakdown where applicable.
- Total and payment method.
- Required legal fields according to the restaurant's configuration and applicable rules.
- Optional thank-you message.

## Accessibility and responsiveness
- Good contrast and readable font sizes.
- Visible focus states.
- Proper labels for form controls.
- Usable at the intended screen resolution; avoid unnecessary animations.
- Core POS must not depend on external fonts, images, or CDN access.
