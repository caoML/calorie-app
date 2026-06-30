/**
 * 运动记录弹窗组件
 * 
 * 功能：
 * 1. 预设运动类型（8种常见运动）快捷选择
 * 2. 自定义运动 + AI 智能估算热量
 * 3. 选择/输入时长
 * 4. 支持手动调整热量
 */

const { request } = require('../../utils/request')

// 运动类型配置（kcal/分钟 为大致中等强度估算值）
const EXERCISE_TYPES = [
  { key: 'running', name: '跑步', icon: '🏃', calPerMin: 10 },
  { key: 'walking', name: '快走', icon: '🚶', calPerMin: 4 },
  { key: 'cycling', name: '骑车', icon: '🚴', calPerMin: 7 },
  { key: 'swimming', name: '游泳', icon: '🏊', calPerMin: 8 },
  { key: 'strength', name: '力量', icon: '🏋️', calPerMin: 6 },
  { key: 'yoga', name: '瑜伽', icon: '🧘', calPerMin: 3 },
  { key: 'skipping', name: '跳绳', icon: '⏭️', calPerMin: 11 },
  { key: 'ball', name: '球类', icon: '⚽', calPerMin: 8 },
]

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    exerciseTypes: EXERCISE_TYPES,
    activeTab: 'preset',       // 'preset' | 'custom'
    // 预设运动相关
    selectedType: '',          // 选中的运动 key
    selectedItem: null,        // 选中的运动对象
    // 自定义运动相关
    customExerciseName: '',    // 自定义运动名称
    aiLoading: false,          // AI 估算加载中
    aiResult: null,            // AI 估算结果
    // 通用
    duration: 30,              // 时长（分钟）
    estimatedKcal: 0,          // 预估消耗（预设模式）
    customKcal: '',            // 手动调整的热量
    finalKcal: 0,              // 最终热量
    canConfirm: false          // 是否可以确认
  },

  observers: {
    'selectedType, duration': function () {
      if (this.data.activeTab === 'preset') {
        this.calcEstimate()
      }
    },
    'customKcal': function (val) {
      const custom = Number(val)
      if (custom > 0) {
        this.setData({ finalKcal: Math.round(custom) })
      } else if (this.data.activeTab === 'preset') {
        this.setData({ finalKcal: this.data.estimatedKcal })
      } else if (this.data.aiResult) {
        this.setData({ finalKcal: this.data.aiResult.kcalBurned })
      }
      this.updateCanConfirm()
    },
    'activeTab, selectedType, customExerciseName, duration, finalKcal, aiResult': function () {
      this.updateCanConfirm()
    }
  },

  methods: {
    // 切换 Tab
    switchTab(e) {
      const tab = e.currentTarget.dataset.tab
      this.setData({
        activeTab: tab,
        // 切换时重置部分状态
        customKcal: '',
        finalKcal: 0
      })
      // 切换到预设时重新算
      if (tab === 'preset' && this.data.selectedType) {
        this.calcEstimate()
      }
      // 切换到自定义时如果有 AI 结果则恢复 finalKcal
      if (tab === 'custom' && this.data.aiResult) {
        this.setData({ finalKcal: this.data.aiResult.kcalBurned })
      }
    },

    // 选择运动类型（预设）
    onSelectType(e) {
      const item = e.currentTarget.dataset.item
      this.setData({
        selectedType: item.key,
        selectedItem: item,
        customKcal: ''
      })
    },

    // 选择快捷时长
    onSelectDuration(e) {
      const duration = e.currentTarget.dataset.duration
      this.setData({ duration, customKcal: '' })
      // 如果在自定义 Tab 且有 AI 结果，时长变了需要重新估算
      if (this.data.activeTab === 'custom' && this.data.aiResult) {
        this.setData({ aiResult: null, finalKcal: 0 })
      }
    },

    // 手动输入时长
    onDurationInput(e) {
      const val = Number(e.detail.value) || 0
      this.setData({ duration: val, customKcal: '' })
      if (this.data.activeTab === 'custom' && this.data.aiResult) {
        this.setData({ aiResult: null, finalKcal: 0 })
      }
    },

    // 手动调整热量
    onKcalInput(e) {
      this.setData({ customKcal: e.detail.value })
    },

    // 自定义运动名称输入
    onCustomNameInput(e) {
      this.setData({
        customExerciseName: e.detail.value,
        aiResult: null,
        finalKcal: this.data.customKcal ? Number(this.data.customKcal) : 0
      })
    },

    // 计算预估消耗（预设模式）
    calcEstimate() {
      const { selectedItem, duration } = this.data
      if (!selectedItem || duration <= 0) {
        this.setData({ estimatedKcal: 0, finalKcal: 0 })
        return
      }
      const estimated = Math.round(selectedItem.calPerMin * duration)
      this.setData({
        estimatedKcal: estimated,
        finalKcal: this.data.customKcal ? Math.round(Number(this.data.customKcal)) : estimated
      })
    },

    // AI 估算运动热量
    async onAiEstimate() {
      const { customExerciseName, duration } = this.data
      if (!customExerciseName || duration <= 0) return

      this.setData({ aiLoading: true, aiResult: null })

      try {
        const res = await request('/exercises/ai-estimate', 'POST', {
          exerciseName: customExerciseName,
          duration
        })

        if (res.code === 0 && res.data) {
          const aiResult = res.data
          this.setData({
            aiResult,
            finalKcal: this.data.customKcal ? Math.round(Number(this.data.customKcal)) : aiResult.kcalBurned,
            aiLoading: false
          })
        } else {
          wx.showToast({ title: '估算失败，请手动输入', icon: 'none' })
          this.setData({ aiLoading: false })
        }
      } catch (err) {
        console.error('AI estimate error:', err)
        wx.showToast({ title: '网络错误，请手动输入', icon: 'none' })
        this.setData({ aiLoading: false })
      }
    },

    // 判断是否可以确认
    updateCanConfirm() {
      const { activeTab, selectedType, customExerciseName, duration, finalKcal, customKcal } = this.data
      let canConfirm = false

      if (activeTab === 'preset') {
        canConfirm = !!selectedType && duration > 0 && finalKcal > 0
      } else {
        // 自定义模式：有名称 + 时长 + (AI结果或手动输入热量)
        const hasKcal = finalKcal > 0 || Number(customKcal) > 0
        canConfirm = !!customExerciseName && duration > 0 && hasKcal
      }

      if (canConfirm !== this.data.canConfirm) {
        this.setData({ canConfirm })
      }
    },

    // 确认记录
    onConfirm() {
      const { activeTab, selectedItem, customExerciseName, aiResult, duration, finalKcal, customKcal } = this.data

      let exerciseName = ''
      let icon = '🏃'
      let kcal = finalKcal || Number(customKcal) || 0

      if (activeTab === 'preset') {
        if (!selectedItem || duration <= 0 || kcal <= 0) return
        exerciseName = selectedItem.name
        icon = selectedItem.icon
      } else {
        if (!customExerciseName || duration <= 0 || kcal <= 0) return
        exerciseName = aiResult ? aiResult.exerciseName : customExerciseName
        icon = '✨'  // 自定义运动用特殊图标
      }

      this.triggerEvent('confirm', {
        exerciseName,
        icon,
        duration,
        kcalBurned: Math.round(kcal)
      })

      // 重置状态
      this.resetForm()
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
      this.resetForm()
    },

    // 重置表单
    resetForm() {
      this.setData({
        activeTab: 'preset',
        selectedType: '',
        selectedItem: null,
        customExerciseName: '',
        aiLoading: false,
        aiResult: null,
        duration: 30,
        estimatedKcal: 0,
        customKcal: '',
        finalKcal: 0,
        canConfirm: false
      })
    },

    // 空方法，用于阻止事件冒泡
    noop() {}
  }
})
