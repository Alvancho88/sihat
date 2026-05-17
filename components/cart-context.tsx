/**
 * cart-context.tsx
 *
 * Provides a global React Context for the user's daily food plan ("cart").
 * The cart is a simple array of FoodItem objects that the user has added from
 * the Food Explorer page or the AI chatbot.
 *
 * Architecture overview:
 *   - CartContext holds the current cart array and four mutation functions.
 *   - CartProvider wraps the entire app (in the root layout) so that any
 *     component tree can access the cart without prop drilling.
 *   - useCart is the hook that child components call to read cart state or
 *     execute mutations.  It throws if called outside of a CartProvider,
 *     which catches accidental misuse early.
 *   - The cart is persisted to localStorage under the key "manis-cart" so it
 *     survives page refreshes.  A `cartLoaded` flag prevents writing an empty
 *     array back to localStorage before the initial hydration read completes.
 *
 * This context is intentionally kept minimal.  The daily-intake summary
 * calculations (totals vs. limits) live in lib/daily-intake-summary.ts and
 * are computed on demand by components that need them.
 */

"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { FoodItem } from "@/lib/food-functions"

/**
 * CartContextType
 *
 * The shape of the value exposed by CartContext.
 *
 *   - `cart`          — The current array of food items in the plan. The order
 *                       reflects the order they were added; most-recent is last.
 *   - `addToCart`     — Appends a food item to the end of the cart array.
 *   - `removeFromCart`— Removes the item at the given array index.  The index
 *                       is position-based (not ID-based) because the same food
 *                       can be added multiple times if desired.
 *   - `clearCart`     — Replaces the entire cart with an empty array.
 *   - `isInCart`      — Returns true when a food with the given English name is
 *                       already in the cart.  Used to toggle the add button state.
 */
type CartContextType = {
  cart: FoodItem[]
  addToCart: (food: FoodItem) => void
  removeFromCart: (index: number) => void
  clearCart: () => void
  isInCart: (name: string) => boolean
}

/**
 * CartContext
 *
 * The React Context object.  Initialized to null so that the `useCart` hook
 * can detect when it is called outside of a CartProvider and throw a helpful
 * error message rather than silently returning undefined.
 */
const CartContext = createContext<CartContextType | null>(null)

/**
 * CartProvider
 *
 * The context provider component.  Should be placed near the root of the
 * component tree (e.g., in the root layout.tsx) so that all pages and the
 * AI chatbot can share the same cart state without re-mounting.
 *
 * Two effects manage localStorage persistence:
 *   1. On mount: reads "manis-cart" from localStorage and hydrates state.
 *      Sets `cartLoaded = true` after hydration so the write effect below
 *      knows it is safe to start persisting.
 *   2. On every cart change (after initial load): serialises the current
 *      cart array to localStorage.  The `cartLoaded` guard prevents
 *      overwriting a valid saved cart with an empty array on the first render.
 *
 * @param children - The React subtree that can access the cart context.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<FoodItem[]>([])
  // Guards the write effect below from running before the initial localStorage
  // read has completed, which would overwrite the saved cart with an empty array.
  const [cartLoaded, setCartLoaded] = useState(false)

  // Effect 1: Hydrate cart from localStorage on first mount.
  // Uses a try/catch to silently discard any corrupted JSON that may have been
  // written by an older version of the app or by the user manually.
  useEffect(() => {
    const savedCart = localStorage.getItem("manis-cart")
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      } catch {
        // Silently ignore corrupted localStorage data.
      }
    }
    setCartLoaded(true)
  }, [])

  // Effect 2: Persist cart to localStorage after every change.
  // Only runs once `cartLoaded` is true so we don't clobber the saved cart
  // before hydration completes on the first render.
  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("manis-cart", JSON.stringify(cart))
    }
  }, [cart, cartLoaded])

  /** Appends a food item to the end of the cart array. */
  const addToCart = (food: FoodItem) => setCart((prev) => [...prev, food])

  /**
   * Removes the cart item at the given zero-based index.
   * The index is stable within a single render cycle but may shift if multiple
   * items are removed in rapid succession — callers should re-derive the index
   * from the current cart snapshot each time.
   */
  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index))

  /** Empties the cart entirely, removing all food items from the daily plan. */
  const clearCart = () => setCart([])

  /**
   * Returns true when a food with the given English name already exists in the
   * cart.  English name is used as the canonical identifier because food names
   * are stored multilingually but English is always present.
   *
   * @param name - The English name of the food to look up (food.name.en).
   * @returns True if the food is already in the cart.
   */
  const isInCart = (name: string) => cart.some((food) => food.name.en === name)

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  )
}

/**
 * useCart
 *
 * Custom hook that returns the CartContext value for the calling component.
 * Must be called inside a component that is a descendant of CartProvider.
 * Throws an error with a descriptive message if called outside CartProvider,
 * which makes misconfiguration obvious during development.
 *
 * @returns The full CartContextType value: { cart, addToCart, removeFromCart, clearCart, isInCart }
 * @throws {Error} When called outside of a CartProvider.
 */
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}
