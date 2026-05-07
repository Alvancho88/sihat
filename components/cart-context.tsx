"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { FoodItem } from "@/lib/food-functions"

type CartContextType = {
  cart: FoodItem[]
  addToCart: (food: FoodItem) => void
  removeFromCart: (index: number) => void
  clearCart: () => void
  isInCart: (name: string) => boolean
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<FoodItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)

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

  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("manis-cart", JSON.stringify(cart))
    }
  }, [cart, cartLoaded])

  const addToCart = (food: FoodItem) => setCart((prev) => [...prev, food])
  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index))
  const clearCart = () => setCart([])
  const isInCart = (name: string) => cart.some((food) => food.name.en === name)

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}
