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
    isManualTarget: false,  // 是否手动设置预算上限
    totalDays: 0,
    streak: 0,
    totalRecords: 0,
    // 成就系统
    achievements: [],
    // 提醒设置
    reminderEnabled: false,
    reminderTimes: [
      { time: '08:00', label: '早餐', enabled: true },
      { time: '12:00', label: '午餐', enabled: true },
      { time: '18:00', label: '晚餐', enabled: true }
    ],
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
    this.loadAchievements()
    this.loadReminder()
  },

  // 加载用户数据
  async loadProfile() {
    try {
      const res = await request('/user/profile', 'GET')
      if (res.code === 0 && res.data) {
        const { gender, age, height, weight, activityLevel, goal, isManualTarget, dailyTarget } = res.data
        this.setData({
          gender: gender || 'male',
          age: age || '',
          height: height || '',
          weight: weight || '',
          activityLevel: activityLevel || 'light',
          goal: goal || 'maintain',
          isManualTarget: !!isManualTarget
        })
        if (isManualTarget && dailyTarget) {
          // 手动模式：直接使用保存的值
          this.setData({ dailyTarget })
        } else {
          // 自动模式：根据身体数据计算
          this.recalculate()
        }
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

  // ====== 提醒设置 ======
  async loadReminder() {
    try {
      const res = await request('/user/reminder', 'GET')
      if (res.code === 0 && res.data) {
        const { enabled, times } = res.data
        const allTimes = [
          { time: '08:00', label: '早餐', enabled: false },
          { time: '12:00', label: '午餐', enabled: false },
          { time: '18:00', label: '晚餐', enabled: false }
        ]
        if (times && times.length) {
          allTimes.forEach(t => {
            t.enabled = times.includes(t.time)
          })
        } else if (enabled) {
          allTimes.forEach(t => { t.enabled = true })
        }
        this.setData({ reminderEnabled: enabled, reminderTimes: allTimes })
      }
    } catch (e) {
      console.log('loadReminder error:', e)
    }
  },

  // 切换提醒开关
  async toggleReminder() {
    const newEnabled = !this.data.reminderEnabled

    if (newEnabled) {
      // 开启时需要请求订阅消息授权
      try {
        await new Promise((resolve, reject) => {
          wx.requestSubscribeMessage({
            // 替换为你在微信公众平台申请的模板 ID
            tmplIds: ['your_template_id_here'],
            success(res) {
              resolve(res)
            },
            fail(err) {
              // 用户拒绝也允许开启（本地提醒仍可用）
              resolve(err)
            }
          })
        })
      } catch (e) {
        // ignore
      }
    }

    this.setData({ reminderEnabled: newEnabled })
    this.saveReminder()
  },

  // 切换某个时间点的开关
  toggleReminderTime(e) {
    const idx = e.currentTarget.dataset.idx
    const reminderTimes = [...this.data.reminderTimes]
    reminderTimes[idx] = { ...reminderTimes[idx], enabled: !reminderTimes[idx].enabled }
    this.setData({ reminderTimes })
    this.saveReminder()
  },

  // 保存提醒设置到服务端
  async saveReminder() {
    const enabledTimes = this.data.reminderTimes
      .filter(t => t.enabled)
      .map(t => t.time)

    try {
      await request('/user/reminder', 'PUT', {
        enabled: this.data.reminderEnabled,
        times: enabledTimes
      })
    } catch (e) {
      console.log('saveReminder error:', e)
    }
  },

  // 加载成就数据
  async loadAchievements() {
    try {
      const res = await request('/records/achievements', 'GET')
      if (res.code === 0 && res.data) {
        const achievements = this.calculateAchievements(res.data)
        this.setData({ achievements })
      }
    } catch (e) {
      console.log('loadAchievements error:', e)
    }
  },

  // 根据原始数据计算成就列表
  calculateAchievements(data) {
    const { totalRecords, totalDays, streak, maxDayRecords, firstRecordDate } = data
    const achievements = []

    // === 记录条数里程碑 ===
    const recordMilestones = [
      { threshold: 1, icon: '🌱', title: '第一步', desc: '完成首次记录' },
      { threshold: 10, icon: '📝', title: '初具规模', desc: '累计记录10条' },
      { threshold: 50, icon: '📊', title: '半百达人', desc: '累计记录50条' },
      { threshold: 100, icon: '💯', title: '百条俱乐部', desc: '累计记录100条' },
      { threshold: 300, icon: '🏅', title: '记录大师', desc: '累计记录300条' },
      { threshold: 500, icon: '👑', title: '记录之王', desc: '累计记录500条' }
    ]
    recordMilestones.forEach(m => {
      achievements.push({
        ...m,
        unlocked: totalRecords >= m.threshold,
        progress: Math.min(totalRecords / m.threshold, 1)
      })
    })

    // === 连续打卡里程碑 ===
    const streakMilestones = [
      { threshold: 3, icon: '🔥', title: '三日之约', desc: '连续记录3天' },
      { threshold: 7, icon: '⭐', title: '一周坚持', desc: '连续记录7天' },
      { threshold: 14, icon: '🌟', title: '两周达人', desc: '连续记录14天' },
      { threshold: 30, icon: '🏆', title: '月度冠军', desc: '连续记录30天' },
      { threshold: 60, icon: '💎', title: '钻石意志', desc: '连续记录60天' },
      { threshold: 100, icon: '🎖️', title: '百日传奇', desc: '连续记录100天' }
    ]
    streakMilestones.forEach(m => {
      achievements.push({
        ...m,
        unlocked: streak >= m.threshold,
        progress: Math.min(streak / m.threshold, 1)
      })
    })

    // === 记录天数里程碑 ===
    const dayMilestones = [
      { threshold: 7, icon: '📅', title: '一周体验', desc: '累计记录7天' },
      { threshold: 30, icon: '🗓️', title: '月度坚持', desc: '累计记录30天' },
      { threshold: 90, icon: '📆', title: '季度达标', desc: '累计记录90天' }
    ]
    dayMilestones.forEach(m => {
      achievements.push({
        ...m,
        unlocked: totalDays >= m.threshold,
        progress: Math.min(totalDays / m.threshold, 1)
      })
    })

    // === 特殊成就 ===
    if (maxDayRecords >= 10) {
      achievements.push({
        icon: '🍱', title: '美食家', desc: '单日记录10+种食物',
        unlocked: true, progress: 1, threshold: 10
      })
    }

    // 按：已解锁在前（按progress倒序），未解锁在后（按progress倒序）
    achievements.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return b.unlocked - a.unlocked
      return b.progress - a.progress
    })

    return achievements
  },

  // 点击成就徽章
  onAchievementTap(e) {
    const item = e.currentTarget.dataset.item
    const status = item.unlocked ? '✅ 已解锁' : `进度 ${Math.round(item.progress * 100)}%`
    wx.showModal({
      title: `${item.icon} ${item.title}`,
      content: `${item.desc}\n${status}`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 跳转历史记录页
  goToHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
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

  // 切换手动/自动模式
  toggleTargetMode() {
    const isManualTarget = !this.data.isManualTarget
    this.setData({ isManualTarget })
    if (!isManualTarget) {
      // 切回自动模式时重新计算
      this.recalculate()
    }
  },

  // 手动输入预算上限
  onTargetInput(e) {
    const val = Number(e.detail.value)
    if (val > 0) {
      this.setData({ dailyTarget: val })
    }
  },

  // 输入框失焦时校验范围
  onTargetBlur(e) {
    let val = Number(e.detail.value)
    if (!val || val < 500) val = 500
    if (val > 5000) val = 5000
    this.setData({ dailyTarget: val })
  },

  // 加减按钮调整预算（每次 ±50）
  adjustTarget(e) {
    const delta = Number(e.currentTarget.dataset.delta)
    let newTarget = this.data.dailyTarget + delta
    if (newTarget < 500) newTarget = 500
    if (newTarget > 5000) newTarget = 5000
    this.setData({ dailyTarget: newTarget })
  },

  // 重新计算目标热量（仅自动模式下生效）
  recalculate() {
    if (this.data.isManualTarget) return  // 手动模式不自动计算

    const { gender, age, height, weight, activityLevel, goal } = this.data
    if (!age || !height || !weight) return

    const bmr = calculateBMR(gender, Number(weight), Number(height), Number(age))
    const tdee = calculateTDEE(bmr, activityLevel)
    const dailyTarget = calculateDailyTarget(tdee, goal)

    this.setData({ bmr, tdee, dailyTarget })
  },

  // 保存设置
  async saveProfile() {
    const { gender, age, height, weight, activityLevel, goal, dailyTarget, isManualTarget } = this.data

    // 自动模式下必须填写身体数据；手动模式下只需要有 dailyTarget
    if (!isManualTarget && (!age || !height || !weight)) {
      wx.showToast({ title: '请填写完整身体数据', icon: 'none' })
      return
    }

    try {
      const res = await request('/user/profile', 'PUT', {
        gender,
        age: Number(age) || 0,
        height: Number(height) || 0,
        weight: Number(weight) || 0,
        activityLevel,
        goal,
        dailyTarget,
        isManualTarget
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
