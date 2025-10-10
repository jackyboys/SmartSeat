'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

export function ThemeToggleButton() {
  const { setTheme, theme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-all duration-300"
      aria-label="切换深色/浅色模式"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}