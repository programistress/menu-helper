import { clsx, type ClassValue } from "clsx" 
import { twMerge } from "tailwind-merge"

// combine class names with tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
