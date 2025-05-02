"use server"

// This file is no longer needed as we're doing client-side validation only
// We're keeping it as an empty file to avoid breaking imports
export async function validatePdf(formData: FormData) {
  return { success: true }
}
