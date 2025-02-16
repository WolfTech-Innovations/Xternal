import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

Vue.config.errorHandler = function (err, vm, info) {
    // Suppress errors
    // console.error(err) // Log errors to console instead of displaying them
  }