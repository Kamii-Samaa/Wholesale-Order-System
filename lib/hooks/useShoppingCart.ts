import { useState } from "react";

/**
 * @interface CartItem
 * @description Represents an item in the shopping cart.
 * @property {number} productId - The unique ID of the product.
 * @property {string} reference - The product reference code.
 * @property {string} size - The size of the product.
 * @property {string} description - The description of the product.
 * @property {number} wholesale_price - The wholesale price of the product.
 * @property {number} quantity - The quantity of this item in the cart.
 * @property {number} stock - The total available stock for this product variant.
 */
export interface CartItem {
  productId: number;
  reference: string;
  size: string;
  description: string;
  wholesale_price: number;
  quantity: number;
  stock: number; // Available stock for this variant
}

/**
 * @interface CustomerInfo
 * @description Basic customer information needed for order submission.
 * @property {string} name - Customer's full name.
 * @property {string} email - Customer's email address.
 * @property {string} [company] - Customer's company name (optional).
 * @property {string} [phone] - Customer's phone number (optional).
 */
export interface CustomerInfo {
  name: string;
  email: string;
  company?: string;
  phone?: string;
}

/**
 * @typedef ProductVariant
 * @description Minimal product variant information needed for adding to cart.
 * @property {number} id - The unique ID of the product variant.
 * @property {string} reference - The product reference code.
 * @property {string} [size] - The size of the product variant.
 * @property {string} [description] - The description of the product.
 * @property {number} [wholesale_price] - The wholesale price of the product.
 * @property {number} stock - The stock of the product variant.
 * @property {number} [reserved_stock] - The reserved stock of the product variant.
 */
export interface ProductVariant {
  id: number;
  reference: string;
  size?: string;
  description?: string;
  wholesale_price?: number;
  stock: number;
  reserved_stock?: number;
}

/**
 * @function useShoppingCart
 * @description Custom hook for managing shopping cart state and actions.
 * @returns {object} The cart state and action functions.
 * @property {CartItem[]} cart - The current state of the shopping cart.
 * @property {function} setCart - Function to directly set the cart state.
 * @property {function} addToCart - Function to add an item to the cart or update its quantity.
 * @property {function} updateQuantity - Function to update the quantity of an item in the cart.
 * @property {function} getTotalAmount - Function to calculate the total amount of the cart.
 * @property {function} clearCart - Function to clear all items from the cart.
 * @property {function} submitOrderToSupabase - Function to handle the Supabase order submission logic. It takes a Supabase client instance and customer information.
 */
export const useShoppingCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  /**
   * Adds a product variant to the cart or updates its quantity if it already exists.
   * It considers available stock before adding/updating.
   * @param {ProductVariant} variant - The product variant to add.
   * @param {number} quantity - The quantity to add.
   * @returns {{success: boolean, message?: string}} An object indicating success or failure with a message.
   */
  const addToCart = (variant: ProductVariant, quantity: number): { success: boolean; message?: string } => {
    const availableStock = variant.stock - (variant.reserved_stock || 0);
    const currentCartItem = cart.find((item) => item.productId === variant.id);
    const currentCartQuantity = currentCartItem?.quantity || 0;

    if (quantity <= 0) {
      return { success: false, message: "Quantity must be greater than zero." };
    }

    if (currentCartQuantity + quantity > availableStock) {
      return {
        success: false,
        message: `Not enough stock. Only ${availableStock - currentCartQuantity} more units can be added.`
      };
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === variant.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === variant.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, availableStock) }
            : item
        );
      }
      return [
        ...prevCart,
        {
          productId: variant.id,
          reference: variant.reference,
          size: variant.size || "",
          description: variant.description || "",
          wholesale_price: variant.wholesale_price || 0,
          quantity: quantity,
          stock: variant.stock, // Store the original stock for reference in cart
        },
      ];
    });
    return { success: true };
  };

  /**
   * Updates the quantity of a specific item in the cart.
   * If new quantity is 0, the item is removed.
   * @param {number} productId - The ID of the product to update.
   * @param {number} newQuantity - The new quantity for the item.
   */
  const updateQuantity = (productId: number, newQuantity: number) => {
    const itemInCart = cart.find(item => item.productId === productId);
    if (!itemInCart) return;

    const availableStock = itemInCart.stock; // Assuming CartItem stores the original variant's stock

    if (newQuantity < 0) return; // Or handle as an error

    if (newQuantity > availableStock) {
      // Optionally, provide feedback to the user that they're exceeding stock
      // For now, we'll cap it at available stock.
      newQuantity = availableStock;
    }

    if (newQuantity === 0) {
      setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.productId === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  /**
   * Calculates the total amount for all items in the cart.
   * @returns {number} The total amount.
   */
  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.wholesale_price * item.quantity, 0);
  };

  /**
   * Clears all items from the shopping cart.
   */
  const clearCart = () => {
    setCart([]);
  };

  /**
   * Submits the order to Supabase.
   * Validates customer information and cart content before proceeding.
   * @param {any} supabase - The Supabase client instance.
   * @param {CustomerInfo} customerInfo - Information about the customer.
   * @returns {Promise<{ success: boolean; message?: string; orderData?: any }>} Result of the submission.
   */
  const submitOrderToSupabase = async (
    supabase: any, // Consider defining a type for the Supabase client if possible
    customerInfo: CustomerInfo
  ): Promise<{ success: boolean; message?: string; orderData?: any }> => {
    if (!customerInfo.name || !customerInfo.email || cart.length === 0) {
      return {
        success: false,
        message: "Customer name, email, and at least one cart item are required.",
      };
    }

    if (!supabase) {
      return { success: false, message: "Database connection not available." };
    }

    try {
      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_company: customerInfo.company,
          customer_phone: customerInfo.phone,
          total_amount: getTotalAmount(),
          status: "pending",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Supabase order error:", orderError);
        return { success: false, message: `Database order error: ${orderError.message}` };
      }

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.wholesale_price,
        total_price: item.wholesale_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

      if (itemsError) {
        console.error("Supabase order items error:", itemsError);
        // Potentially attempt to roll back the order creation or mark it as failed.
        // For now, returning an error message.
        return { success: false, message: `Database order items error: ${itemsError.message}` };
      }

      return { success: true, orderData };
    } catch (error: any) {
      console.error("Error submitting order to Supabase:", error);
      return { success: false, message: `Error submitting order: ${error.message}` };
    }
  };

  return {
    cart,
    setCart,
    addToCart,
    updateQuantity,
    getTotalAmount,
    clearCart,
    submitOrderToSupabase, // Expose the new function
  };
};
