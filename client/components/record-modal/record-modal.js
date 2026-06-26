const { getDefaultMeal } = require('../../utils/util')

Component({
  properties: {
    show: { type: Boolean, value: false },
    food: { type: Object, value: null }
  },

  data: {
    portionOptions: [],
    selectedPortion: 100,
    customGrams: '',
    selectedMeal: '',
    estimatedKcal: 0,
    totalKcal: 0,
    // 分食相关
    showShare: false,
    sharePeople: 1,
    shareRatio: 'equal',
    shareText: '',
    mealOptions: [
      { key: 'breakfast', name: '早餐' },
      { key: 'lunch', name: '午餐' },
      { key: 'dinner', name: '晚餐' },
      { key: 'snack', name: '加餐' }
    ]
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.initModal()
      }
    },
    'food': function(food) {
      if (food) {
        this.initPortionOptions(food)
      }
    }
  },

  methods: {
    // 初始化弹窗
    initModal() {
      const defaultMeal = getDefaultMeal()
      this.setData({
        selectedMeal: defaultMeal,
        showShare: false,
        sharePeople: 1,
        shareRatio: 'equal',
        shareText: ''
      })
    },

    // 初始化份量选项
    initPortionOptions(food) {
      if (food.customKcal) {
        this.setData({
          estimatedKcal: food.customKcal,
          totalKcal: food.customKcal,
          portionOptions: []
        })
        return
      }

      // 根据食物生成常用份量
      let options = [
        { label: '50g', value: 50 },
        { label: '100g', value: 100 },
        { label: '150g', value: 150 },
        { label: '200g', value: 200 }
      ]

      // 如果食物有常用份量信息
      if (food.servings && food.servings.length > 0) {
        options = food.servings.map(s => ({
          label: s.label,
          value: s.grams
        }))
      }

      const defaultPortion = options.length > 0 ? options[Math.min(1, options.length - 1)].value : 100
      const totalKcal = Math.round(food.kcalPer100g * defaultPortion / 100)

      this.setData({
        portionOptions: options,
        selectedPortion: defaultPortion,
        customGrams: '',
        totalKcal,
        estimatedKcal: totalKcal
      })
    },

    // 选择快捷份量
    selectPortion(e) {
      const value = e.currentTarget.dataset.value
      this.setData({
        selectedPortion: value,
        customGrams: ''
      })
      this.recalcKcal()
    },

    // 自定义克数输入
    onCustomInput(e) {
      this.setData({
        customGrams: e.detail.value,
        selectedPortion: 0
      })
      this.recalcKcal()
    },

    // 切换分食面板
    toggleShare() {
      this.setData({ showShare: !this.data.showShare })
    },

    // 选择分食人数
    selectSharePeople(e) {
      const value = e.currentTarget.dataset.value
      this.setData({ sharePeople: value })
      if (value === 1) {
        this.setData({ shareRatio: 'equal' })
      }
      this.recalcKcal()
    },

    // 选择分食比例
    selectShareRatio(e) {
      const value = e.currentTarget.dataset.value
      this.setData({ shareRatio: value })
      this.recalcKcal()
    },

    // 重新计算热量
    recalcKcal() {
      const food = this.properties.food
      if (!food || food.customKcal) return

      const grams = this.data.customGrams ? Number(this.data.customGrams) : this.data.selectedPortion
      const totalKcal = Math.round(food.kcalPer100g * grams / 100)

      const { sharePeople, shareRatio } = this.data
      const ratio = this.calcShareRatio(sharePeople, shareRatio)
      const myKcal = Math.round(totalKcal * ratio)

      let shareText = ''
      if (sharePeople > 1) {
        const ratioLabel = { less: '少一些', equal: '均分', more: '多一些' }[shareRatio] || '均分'
        shareText = `${sharePeople}人 · ${ratioLabel}`
      }

      this.setData({
        totalKcal,
        estimatedKcal: myKcal,
        shareText
      })
    },

    // 计算"我吃的比例"：与 wxml 文案保持一致，且恒不超过整盘
    calcShareRatio(sharePeople, shareRatio) {
      if (!sharePeople || sharePeople <= 1) return 1
      if (shareRatio === 'less') {
        // 少一些：约 1/(n+1)
        return 1 / (sharePeople + 1)
      }
      if (shareRatio === 'more') {
        // 多一些：约 (n-1)/n，n=2 时即 1/2…这里取"均分到剩余全部之间"的偏多值
        return Math.min((sharePeople - 1) / sharePeople, 0.9)
      }
      // 均分：1/n
      return 1 / sharePeople
    },

    // 选择餐次
    selectMeal(e) {
      this.setData({ selectedMeal: e.currentTarget.dataset.key })
    },

    // 确认记录
    onConfirm() {
      const food = this.properties.food
      const { selectedPortion, customGrams, selectedMeal, estimatedKcal, sharePeople, shareRatio } = this.data

      // 整份克数（这道菜整体的量）
      const fullAmount = customGrams ? Number(customGrams) : selectedPortion
      const unit = food.customKcal ? '份' : 'g'
      // 分食后我实际摄入的量（克），与 kcal 口径一致
      const ratio = this.calcShareRatio(sharePeople, shareRatio)
      const myAmount = food.customKcal ? 1 : Math.round(fullAmount * ratio)

      this.triggerEvent('confirm', {
        food,
        amount: myAmount,
        unit,
        meal: selectedMeal,
        kcal: estimatedKcal,
        sharePeople: sharePeople || 1,
        shareRatio: sharePeople > 1 ? shareRatio : 'equal'
      })
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 阻止冒泡
    preventBubble() {},
    preventMove() {}
  }
})
