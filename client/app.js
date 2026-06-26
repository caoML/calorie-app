App({
  globalData: {
    userInfo: null,
    baseUrl: 'http://106.54.31.24:3000/api', // 服务器地址；正式上线需改为 https 域名（微信要求）
    token: ''
  },

  onLaunch() {
    // 检查登录态
    this.checkLogin()
  },

  // 检查登录态
  checkLogin() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.globalData.loginPromise = Promise.resolve()
      this.getUserInfo()
    } else {
      // 存储登录的 Promise，供 request 等待
      this.globalData.loginPromise = this.login()
    }
  },

  // 获取用户信息
  getUserInfo() {
    const { request } = require('./utils/request')
    request('/user/profile', 'GET').then(res => {
      if (res.code === 0) {
        this.globalData.userInfo = res.data
      }
    }).catch(e => {
      console.log('getUserInfo error:', e)
    })
  },

  // 微信登录（直接用 wx.request，不依赖 request 封装，避免循环）
  login() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          // 正常拿到 code 用 code，拿不到则用本地稳定 code 兜底
          this.serverLogin(res.code || this.getDevCode(), resolve)
        },
        fail: (err) => {
          // wx.login 调用失败（如开发者工具 appid 无权限 INVALID_TOKEN），
          // 开发环境用本地持久化的稳定 code 兜底，绕开微信平台登录
          console.log('wx.login 调用失败，使用本地兜底 code:', err && err.errMsg)
          this.serverLogin(this.getDevCode(), resolve)
        }
      })
    })
  },

  // 用 code 换取后端 token
  serverLogin(code, resolve) {
    wx.request({
      url: this.globalData.baseUrl + '/auth/login',
      method: 'POST',
      data: { code },
      header: { 'Content-Type': 'application/json' },
      success: (loginRes) => {
        // NestJS 的 POST 默认返回 201，这里接受 2xx
        if (loginRes.statusCode >= 200 && loginRes.statusCode < 300 && loginRes.data.code === 0) {
          const token = loginRes.data.data.token
          wx.setStorageSync('token', token)
          this.globalData.token = token
          console.log('✅ 登录成功')
          this.getUserInfo()
          resolve(loginRes.data.data)
        } else {
          console.log('登录接口返回异常:', loginRes.data)
          resolve(null)
        }
      },
      fail: (err) => {
        console.log('登录请求失败:', err)
        resolve(null)
      }
    })
  },

  // 获取本地持久化的稳定 code（开发环境兜底用，保证同一台机器是同一个用户）
  getDevCode() {
    let code = wx.getStorageSync('dev_code')
    if (!code) {
      code = 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
      wx.setStorageSync('dev_code', code)
    }
    return code
  }
})
