import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { Recipe } from "@dripleaf/registry"

export { Recipe }

export type RecipeData = Record<string, any>

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RECIPES_DIR = resolve(__dirname, "../../../generated/data/minecraft/recipe")

function loadRecipeData(recipeName: string): RecipeData | undefined {
  try {
    const path = resolve(RECIPES_DIR, `${recipeName}.json`)
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return undefined
  }
}

export class RecipeRegistry {
  static #instance: RecipeRegistry | undefined
  #cache: Map<Recipe, RecipeData> = new Map()

  private constructor() {}

  static getInstance(): RecipeRegistry {
    if (!RecipeRegistry.#instance) {
      RecipeRegistry.#instance = new RecipeRegistry()
    }
    return RecipeRegistry.#instance
  }

  getRecipe(recipe: Recipe): RecipeData | undefined {
    let data = this.#cache.get(recipe)
    if (data === undefined) {
      data = loadRecipeData(recipe as string)
      if (data) {
        this.#cache.set(recipe, data)
      }
    }
    return data
  }

  getRecipes(): Recipe[] {
    // Return all enum values
    return Object.values(Recipe)
  }
}

export function getRecipeData(recipe: Recipe): RecipeData | undefined {
  return RecipeRegistry.getInstance().getRecipe(recipe)
}