const axios = require("axios");

class HttpClient {
  constructor(user) {
    this.instance = null;
    this.setUser(user);
  }

  async initialize() {
    try {
      this.instance = axios.create({
        headers: {
          Authorization: this.user.authorization,
        },
      });
      Promise.resolve();
    } catch (e) {
      console.log("Error: " + e);
      Promise.reject(e);
    }
  }

  setUser(user) {
    this.user = user;
  }

  async get(url) {
    if (this.instance == null) {
      await this.initialize();
    }
    return await this.instance.get(url);
  }

  async post(url, data) {
    if (this.instance == null) {
      await this.initialize();
    }
    return await this.instance.post(url, data);
  }

  async put(url, data) {
    if (this.instance == null) {
      await this.initialize();
    }
    return await this.instance.put(url, data);
  }
}

exports.HttpClient = HttpClient;
