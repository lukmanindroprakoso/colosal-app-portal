import { defineConfig } from "wxt"

// Set WXT_COLOSAL_URL in the shell to build against another deployment.
const colosal = new URL(process.env.WXT_COLOSAL_URL ?? "http://localhost:3000")

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Colosal",
    description: "Buat proposal Upwork dan optimalkan profil Anda dengan Colosal.",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz402jliXYcZKkRXIaPtvB9dsGsXwE4f3aGzMn+46JPJ4Az7rx0992O2N06nmDTzYMnGuTGap/4vho/QZkjI6/88YKRE3s4ng7kxSQ5X6pQt6LI7LG8z9boo1KMTQEOrWvKva01PfBMCGIZun4qnp2tFtbwBOAFyIIKilqhk1t5qTIiX+XVElmcGqbyUhip4jq/m+ifLKnnJynIhzCI1jeGpducx2oHT9wmNCnwq5M9/ItWUFvxKDh7dgpGvQU4xBZfSnFUClQXjx1eWQYqS+PfO+sixqVXqN2rqdR25ircZDaEGlv2zsnDk6GlFoZ/TdYXYfHBoA3+E97jCHONvi+QIDAQAB",
    permissions: ["sidePanel", "scripting"],
    host_permissions: ["https://*.upwork.com/*", `${colosal.protocol}//${colosal.hostname}/*`],
    action: { default_title: "Colosal" },
  },
})
