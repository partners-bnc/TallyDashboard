'use client'

export function assignDocument(url: string) {
  window.location.assign(url)
}

export function replaceDocument(url: string) {
  window.location.replace(url)
}
