/**
 * 图片选择、压缩与上传工具
 * 解决微信小程序上传文件 2MB 限制问题
 */

function getAppInstance() {
  return getApp() || {}
}

function getToken() {
  const app = getAppInstance()
  return (app.globalData && app.globalData.token) || wx.getStorageSync('token') || ''
}

/**
 * 压缩图片到指定大小以内
 * @param {string} filePath - 原始图片路径
 * @param {number} maxSizeKB - 最大文件大小(KB)，默认1500KB(1.5MB)
 * @param {number} quality - 初始压缩质量(0-100)，默认80
 * @returns {Promise<string>} 压缩后的图片临时路径
 */
function compressImage(filePath, maxSizeKB = 1500, quality = 80) {
  return new Promise((resolve, reject) => {
    // 先检查文件大小
    wx.getFileInfo({
      filePath,
      success(info) {
        const sizeKB = info.size / 1024
        console.log(`[upload] 原始图片大小: ${(sizeKB / 1024).toFixed(2)}MB`)

        if (sizeKB <= maxSizeKB) {
          // 已经在限制内，不需要压缩
          resolve(filePath)
          return
        }

        // 使用 wx.compressImage 压缩
        doCompress(filePath, quality, maxSizeKB, resolve, reject)
      },
      fail(err) {
        // 获取文件信息失败，尝试直接压缩
        doCompress(filePath, quality, maxSizeKB, resolve, reject)
      }
    })
  })
}

/**
 * 递归压缩直到满足大小要求
 */
function doCompress(filePath, quality, maxSizeKB, resolve, reject) {
  if (quality < 10) {
    // 质量已经很低还超限，用 canvas 缩小尺寸
    canvasResize(filePath, maxSizeKB).then(resolve).catch(reject)
    return
  }

  wx.compressImage({
    src: filePath,
    quality,
    success(res) {
      wx.getFileInfo({
        filePath: res.tempFilePath,
        success(info) {
          const sizeKB = info.size / 1024
          console.log(`[upload] 压缩后(quality=${quality}): ${(sizeKB / 1024).toFixed(2)}MB`)

          if (sizeKB <= maxSizeKB) {
            resolve(res.tempFilePath)
          } else {
            // 继续降低质量
            doCompress(res.tempFilePath, quality - 20, maxSizeKB, resolve, reject)
          }
        },
        fail() {
          // 无法获取大小，直接返回压缩结果
          resolve(res.tempFilePath)
        }
      })
    },
    fail(err) {
      console.warn('[upload] compressImage 失败:', err)
      // 降级：用 canvas 方式压缩
      canvasResize(filePath, maxSizeKB).then(resolve).catch(reject)
    }
  })
}

/**
 * Canvas 方式缩小图片尺寸（兜底方案）
 */
function canvasResize(filePath, maxSizeKB) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success(imgInfo) {
        let { width, height } = imgInfo
        // 按比例缩小到合理尺寸(最长边不超过1920)
        const maxSide = 1920
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // 使用离屏 canvas
        const canvas = wx.createOffscreenCanvas({ type: '2d', width, height })
        const ctx = canvas.getContext('2d')
        const img = canvas.createImage()

        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height)
          wx.canvasToTempFilePath({
            canvas,
            destWidth: width,
            destHeight: height,
            fileType: 'jpg',
            quality: 0.7,
            success(res) {
              console.log(`[upload] canvas 缩放完成: ${width}x${height}`)
              resolve(res.tempFilePath)
            },
            fail(err) {
              console.warn('[upload] canvasToTempFilePath 失败:', err)
              // 最终兜底：返回原图让上传去尝试
              resolve(filePath)
            }
          })
        }
        img.onerror = () => {
          resolve(filePath)
        }
        img.src = filePath
      },
      fail() {
        resolve(filePath)
      }
    })
  })
}

/**
 * 选择图片（拍照/相册）并自动压缩
 * @param {object} options
 * @param {number} options.count - 选择图片数量，默认1
 * @param {number} options.maxSizeKB - 最大文件大小(KB)，默认1500
 * @returns {Promise<string[]>} 压缩后的图片路径数组
 */
function chooseAndCompress(options = {}) {
  const { count = 1, maxSizeKB = 1500 } = options
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'], // 先让微信系统压缩一次
      success(res) {
        const tasks = res.tempFiles.map(file => compressImage(file.tempFilePath, maxSizeKB))
        Promise.all(tasks).then(resolve).catch(reject)
      },
      fail(err) {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          reject({ cancelled: true })
        } else {
          reject(err)
        }
      }
    })
  })
}

/**
 * 上传图片到后端
 * @param {string} filePath - 本地图片路径（已压缩）
 * @param {string} uploadUrl - 上传接口路径，如 '/upload/image'
 * @param {object} formData - 附带的表单数据
 * @returns {Promise<object>} 后端返回的数据
 */
function uploadImage(filePath, uploadUrl, formData = {}) {
  const app = getAppInstance()
  const token = getToken()
  const baseUrl = (app.globalData && app.globalData.baseUrl) || ''

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: baseUrl + uploadUrl,
      filePath,
      name: 'file',
      formData,
      header: {
        'Authorization': token ? ('Bearer ' + token) : ''
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data)
            resolve(data)
          } catch (e) {
            resolve(res.data)
          }
        } else {
          reject({ code: res.statusCode, message: '上传失败' })
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/**
 * 一站式：选图 → 压缩 → 上传
 * @param {string} uploadUrl - 上传接口路径
 * @param {object} options
 * @param {number} options.count - 选择图片数量
 * @param {number} options.maxSizeKB - 压缩后最大KB
 * @param {object} options.formData - 附带表单数据
 * @returns {Promise<object[]>} 上传结果数组
 */
function chooseCompressUpload(uploadUrl, options = {}) {
  const { count = 1, maxSizeKB = 1500, formData = {} } = options

  return chooseAndCompress({ count, maxSizeKB })
    .then(filePaths => {
      const tasks = filePaths.map(fp => uploadImage(fp, uploadUrl, formData))
      return Promise.all(tasks)
    })
}

module.exports = {
  compressImage,
  chooseAndCompress,
  uploadImage,
  chooseCompressUpload,
}
