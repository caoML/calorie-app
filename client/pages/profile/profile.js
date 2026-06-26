const { request } = require('../../utils/request')
const { calculateBMR, calculateTDEE, calculateDailyTarget } = require('../../utils/util')

Page({
  data: {
    gender: 'male',
    age: '',
    height: '',
    weight: '',
    activityLevel: 'light',
    goal: 'maintain',
    bmr: 0,
    tdee: 0,
    dailyTarget: 1800,
    totalDays: 0,
    streak: 0,
    totalRecords: 0,
    activityOptions: [
      { key: 'sedentary', name: '久坐不动', desc: '办公室工作，几乎不运动' },
      { key: 'light', name: '轻度活动', desc: '每周运动1-3天' },
      { key: 'moderate', name: '中度活动', desc: '每周运动3-5天' },
      { key: 'active', name: '高强度', desc: '每周运动6-7天' },
      { key: 'veryActive', name: '超高强度', desc: '体力劳动/专业运动员' }
    ],
    goalOptions: [
      { key: 'lose', name: '减脂', icon: '📉', desc: 'TDEE-500' },
      { key: 'maintain', name: '维持', icon: '⚖️', desc: '= TDEE' },
      { key: 'gain', name: '增肌', icon: '💪', desc: 'TDEE+300' }
    ]
  },

  onShow() {
    this.loadProfile()
    this.loadStats()
  },

  // 加载用户数据
  async loadProfile() {
    try {
      const res = await request('/user/profile', 'GET')
      if (res.code === 0 && res.data) {
        const { gender, age, height, weight, activityLevel, goal } = res.data
        this.setData({
          gender: gender || 'male',
          age: age || '',
          height: height || '',
          weight: weight || '',
          activityLevel: activityLevel || 'light',
          goal: goal || 'maintain'
        })
        this.recalculate()
      }
    } catch (e) {
      console.log('loadProfile error:', e)
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const res = await request('/user/stats', 'GET')
      if (res.code === 0 && res.data) {
        this.setData({
          totalDays: res.data.totalDays || 0,
          streak: res.data.streak || 0,
          totalRecords: res.data.totalRecords || 0
        })
      }
    } catch (e) {
      console.log('loadStats error:', e)
    }
  },

  // 设置性别
  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.value })
    this.recalculate()
  },

  // 输入年龄
  onAgeInput(e) {
    this.setData({ age: e.detail.value })
    this.recalculate()
  },

  // 输入身高
  onHeightInput(e) {
    this.setData({ height: e.detail.value })
    this.recalculate()
  },

  // 输入体重
  onWeightInput(e) {
    this.setData({ weight: e.detail.value })
    this.recalculate()
  },

  // 设置活动量
  setActivity(e) {
    this.setData({ activityLevel: e.currentTarget.dataset.key })
    this.recalculate()
  },

  // 设置目标
  setGoal(e) {
    this.setData({ goal: e.currentTarget.dataset.key })
    this.recalculate()
  },

  // 重新计算目标热量
  recalculate() {
    const { gender, age, height, weight, activityLevel, goal } = this.data
    if (!age || !height || !weight) return

    const bmr = calculateBMR(gender, Number(weight), Number(height), Number(age))
    const tdee = calculateTDEE(bmr, activityLevel)
    const dailyTarget = calculateDailyTarget(tdee, goal)

    this.setData({ bmr, tdee, dailyTarget })
  },

  // 保存设置
  async saveProfile() {
    const { gender, age, height, weight, activityLevel, goal, dailyTarget } = this.data

    if (!age || !height || !weight) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    try {
      const res = await request('/user/profile', 'PUT', {
        gender,
        age: Number(age),
        height: Number(height),
        weight: Number(weight),
        activityLevel,
        goal,
        dailyTarget
      })
      if (res.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        // 更新全局用户信息
        const app = getApp()
        app.globalData.userInfo = { ...app.globalData.userInfo, dailyTarget }
      }
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
