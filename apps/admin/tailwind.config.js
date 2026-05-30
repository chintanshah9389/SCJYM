/** @type {import('tailwindcss').Config} */
const path = require('path');

module.exports = {
  content: [
    path.resolve(__dirname, './src/**/*.{ts,tsx,js,jsx}'),
    // include monorepo shared package (if shared components contain classes)
    path.resolve(__dirname, '../../packages/shared/src/**/*.{ts,tsx,js,jsx}'),
  ],
  safelist: [
    'bg-gray-50',
    'text-gray-900',
  ],
  theme: { extend: {} },
  plugins: [],
};
