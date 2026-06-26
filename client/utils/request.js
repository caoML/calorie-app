/**
 * 网络请求封装
 */
// 惰性获取 App 实例：模块 require 时 App 可能尚未初始化，
// 在真正用到时再调用 getApp()，避免 app 为 undefined。
function getAppInstance() {
  return getApp() || {}
}

// 不需要等待登录的公开接口
const PUBLIC_APIS = ['/auth/login', '/foods/search', '/foods/category']

// 登录去重：并发请求只触发一次登录
let _loginPromise = null

function getToken() {
  const app = getAppInstance()
  return (app.globalData && app.globalData.token) || wx.getStorageSync('token') || ''
}

// 重新登录（清掉旧 token，重新走 wx.login 换 token），并发去重
function relogin() {
  const app = getAppInstance()
  if (!_loginPromise) {
    if (app.globalData) {
      app.globalData.token = ''
      app.globalData.loginPromise = null
    }
    wx.removeStorageSync('token')
    _loginPromise = Promise.resolve(app.login ? app.login() : null)
      .then(() => {
        _loginPromise = null
        return getToken()
      })
      .catch(() => {
        _loginPromise = null
        return ''
      })
  }
  return _loginPromise
}

// 确保 token 就绪：有则直接用，没有则复用启动登录或主动登录
function ensureLogin() {
  const app = getAppInstance()
  const token = getToken()
  if (token) {
    if (app.globalData) app.globalData.token = token
    return Promise.resolve(token)
  }
  // 复用 app 启动时已发起的登录，避免重复登录
  if (app.globalData && app.globalData.loginPromise) {
    return Promise.resolve(app.globalData.loginPromise).then(() => getToken() || relogin())
  }
  return relogin()
}

function request(url, method = 'GET', data = {}) {
  // 公开接口不需要等待 token，直接发请求
  if (PUBLIC_APIS.some(api => url.startsWith(api))) {
    return doRequest(url, method, data)
  }
  // 其他接口先确保 token 就绪
  return ensureLogin().then(() => doRequest(url, method, data))
}

function doRequest(url, method, data, isRetry = false) {
  const app = getAppInstance()
  // 每次发请求时实时读取最新的 token
  const token = getToken()
  const baseUrl = (app.globalData && app.globalData.baseUrl) || ''
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : ''
      },
      success(res) {
        // NestJS 的 POST/PATCH 默认返回 201/200，这里统一接受 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401 && !isRetry) {
          // token 失效：清掉旧 token，重新登录后重试一次（只重试一次，避免死循环）
          console.log('⚠️ 401，清除旧 token 并重新登录后重试:', url)
          relogin().then((newToken) => {
            if (newToken) {
              doRequest(url, method, data, true).then(resolve).catch(reject)
            } else {
              reject({ code: 401, message: '重新登录失败' })
            }
          })
        } else if (res.statusCode === 401) {
          // 重试后仍 401，不再重试
          console.log('⚠️ 重试后仍 401:', url)
          reject({ code: 401, message: '未登录或token已过期' })
        } else {
          reject(res.data || '请求失败')
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = { request }
