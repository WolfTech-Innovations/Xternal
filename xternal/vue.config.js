const { defineConfig } = require('@vue/cli-service')
module.exports = {
  devServer: {
    client: {
      webSocketURL: 'wss://localhost:8080/ws'
    }
  }
};
