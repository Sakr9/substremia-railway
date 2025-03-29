module.exports = {
  darkMode: 'class',
  content: [
      "./server/public/**/*.{html,js}",
      "./node_modules/flowbite/**/*.js"
    ],
    theme: {
      extend: {},
    },
    plugins: [
      require('flowbite/plugin')
    ],
  }
