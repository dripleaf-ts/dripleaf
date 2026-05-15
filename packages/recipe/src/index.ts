import { Recipe } from "@dripleaf/registry"
import { RECIPE_DATA, type RecipeData } from "./data.generated"

export { Recipe }
export type { RecipeData }

export class RecipeRegistry {
  static #instance: RecipeRegistry | undefined

  private constructor() {}

  static getInstance(): RecipeRegistry {
    if (!RecipeRegistry.#instance)
      RecipeRegistry.#instance = new RecipeRegistry()
    return RecipeRegistry.#instance
  }

  getRecipe(recipe: Recipe): RecipeData | undefined {
    return RECIPE_DATA[recipe]
  }

  getRecipes(): Recipe[] {
    return Object.values(Recipe)
  }
}

export function getRecipeData(recipe: Recipe): RecipeData | undefined {
  return RecipeRegistry.getInstance().getRecipe(recipe)
}
