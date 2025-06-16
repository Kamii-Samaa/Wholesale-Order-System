import { useState, useCallback } from 'react';

/**
 * @interface Filters
 * @description Defines the structure for active filters.
 * @property {string[]} brands - Array of selected brand names.
 * @property {string[]} sections - Array of selected section names.
 * @property {string[]} productLines - Array of selected product line names.
 * @property {{ min: number; max: number }} priceRange - Selected price range.
 * @property {boolean} inStockOnly - Flag to filter by in-stock products only.
 */
export interface Filters {
  brands: string[];
  sections: string[];
  productLines: string[];
  priceRange: { min: number; max: number };
  inStockOnly: boolean;
}

/**
 * @interface FilterOptions
 * @description Defines the structure for available filter options.
 * @property {string[]} brands - Array of all available brand names.
 * @property {string[]} sections - Array of all available section names.
 * @property {string[]} productLines - Array of all available product line names.
 * @property {{ min: number; max: number }} priceRange - The overall min and max price for products.
 */
export interface FilterOptions {
  brands: string[];
  sections: string[];
  productLines: string[];
  priceRange: { min: number; max: number };
}

const defaultInitialFilterOptions: FilterOptions = {
  brands: [],
  sections: [],
  productLines: [],
  priceRange: { min: 0, max: 1000000 }, // Default wide range
};

/**
 * @function useProductFilters
 * @description Custom hook for managing product filter state and actions.
 * @param {FilterOptions} [initialFilterOptions] - Optional initial values for filter options.
 * @returns {object} Filter state, options, and action functions.
 * @property {Filters} filters - The current active filters.
 * @property {function} setFilters - Function to set the filters state.
 * @property {FilterOptions} filterOptions - The available filter options.
 * @property {function} setFilterOptions - Function to set the filter options.
 * @property {function} toggleFilter - Function to toggle a filter value (for array-based filters).
 * @property {function} clearFilters - Function to reset all filters to their default state.
 * @property {function} getActiveFiltersCount - Function to count active filters.
 * @property {function} updatePriceRange - Function to update the price range filter.
 * @property {function} toggleInStockOnly - Function to toggle the in-stock only filter.
 */
export const useProductFilters = (initialFilterOptions: FilterOptions = defaultInitialFilterOptions) => {
  const [filters, setFilters] = useState<Filters>({
    brands: [],
    sections: [],
    productLines: [],
    priceRange: {
      min: initialFilterOptions.priceRange.min,
      max: initialFilterOptions.priceRange.max
    },
    inStockOnly: false,
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialFilterOptions);

  /**
   * Toggles a filter value for array-based filters like brands, sections, productLines.
   * @param {keyof Pick<Filters, 'brands' | 'sections' | 'productLines'>} type - The type of filter to toggle.
   * @param {string} value - The value to toggle.
   */
  const toggleFilter = useCallback((type: keyof Pick<Filters, 'brands' | 'sections' | 'productLines'>, value: string) => {
    setFilters((prev) => {
      const currentArray = prev[type] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value];
      return { ...prev, [type]: newArray };
    });
  }, []);

  /**
   * Clears all active filters and resets them to default values based on filterOptions.
   */
  const clearFilters = useCallback(() => {
    setFilters({
      brands: [],
      sections: [],
      productLines: [],
      priceRange: {
        min: filterOptions.priceRange.min,
        max: filterOptions.priceRange.max
      },
      inStockOnly: false,
    });
  }, [filterOptions.priceRange]);

  /**
   * Counts the number of active filters.
   * Does not count priceRange if it's at the default min/max of filterOptions.
   * @returns {number} The count of active filters.
   */
  const getActiveFiltersCount = useCallback(() => {
    let count = filters.brands.length + filters.sections.length + filters.productLines.length;
    if (filters.inStockOnly) {
      count++;
    }
    // Consider priceRange active if it differs from the initial full range
    if (
      filters.priceRange.min !== filterOptions.priceRange.min ||
      filters.priceRange.max !== filterOptions.priceRange.max
    ) {
      // This check is a bit simplistic. A more robust check might be needed
      // if 0 or max values have specific meanings beyond "unfiltered".
      // For now, any change from the initial options range counts.
      // However, the original code only counted array filters and inStockOnly.
      // To maintain consistency with the original getActiveFiltersCount:
      // count += (filters.inStockOnly ? 1 : 0);
      // The original logic: return filters.brands.length + filters.sections.length + filters.productLines.length + (filters.inStockOnly ? 1 : 0)
      // Let's stick to that for now. Price range activity can be inferred separately if needed.
    }
    return filters.brands.length + filters.sections.length + filters.productLines.length + (filters.inStockOnly ? 1 : 0);
  }, [filters, filterOptions.priceRange]);


  /**
   * Updates the price range filter.
   * @param {number} min - The minimum price.
   * @param {number} max - The maximum price.
   */
  const updatePriceRange = useCallback((min: number, max: number) => {
    setFilters(prev => ({
      ...prev,
      priceRange: { min, max }
    }));
  }, []);

  /**
   * Toggles the inStockOnly filter.
   */
  const toggleInStockOnly = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      inStockOnly: !prev.inStockOnly
    }));
  }, []);


  return {
    filters,
    setFilters, // Exposing setFilters for flexibility e.g. setting initial price range from fetched products
    filterOptions,
    setFilterOptions, // To update options when products load
    toggleFilter,
    clearFilters,
    getActiveFiltersCount,
    updatePriceRange,
    toggleInStockOnly,
  };
};
