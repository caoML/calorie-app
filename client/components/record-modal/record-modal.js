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
    customKcal: 0,
    selectedMeal: '',
    selectedMealName: '午餐',
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
      const mealNameMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }
      this.setData({
        selectedMeal: defaultMeal,
        selectedMealName: mealNameMap[defaultMeal] || '午餐',
        showShare: false,
        sharePeople: 1,
        shareRatio: 'equal',
        shareText: '',
        customKcal: 0
      })
    },

    // 初始化份量选项（生活化描述）
    initPortionOptions(food) {
      if (food.customKcal) {
        this.setData({
          estimatedKcal: food.customKcal,
          totalKcal: food.customKcal,
          portionOptions: []
        })
        return
      }

      // 如果食物有常用份量信息，直接使用
      let options
      if (food.servings && food.servings.length > 0) {
        options = food.servings.map(s => ({
          label: s.label,
          value: s.grams,
          desc: s.desc || '',
          kcal: Math.round(food.kcalPer100g * s.grams / 100)
        }))
      } else {
        // 默认份量使用生活化描述
        options = this.getVisualPortions(food)
        // 为每个选项计算热量
        options = options.map(opt => ({
          ...opt,
          kcal: Math.round(food.kcalPer100g * opt.value / 100)
        }))
      }

      const defaultPortion = options.length > 0 ? options[Math.min(1, options.length - 1)].value : 100
      const totalKcal = Math.round(food.kcalPer100g * defaultPortion / 100)

      this.setData({
        portionOptions: options,
        selectedPortion: defaultPortion,
        customGrams: '',
        customKcal: 0,
        totalKcal,
        estimatedKcal: totalKcal
      })
    },

    // 根据食物类型生成可视化份量描述
    getVisualPortions(food) {
      const category = food.category || ''
      
      // 主食类
      if (category === 'staple' || /米饭|面|粥|馒头|包子|饺子/.test(food.name)) {
        return [
          { label: '小碗', value: 100, desc: '≈ 拳头大小' },
          { label: '一碗', value: 200, desc: '≈ 普通碗' },
          { label: '大碗', value: 300, desc: '≈ 满满一碗' }
        ]
      }
      // 肉类
      if (category === 'meat' || /肉|鸡|鱼|虾|蛋/.test(food.name)) {
        return [
          { label: '几块', value: 50, desc: '≈ 手心大' },
          { label: '一份', value: 100, desc: '≈ 巴掌大' },
          { label: '大份', value: 200, desc: '≈ 满满一盘' }
        ]
      }
      // 蔬菜类
      if (category === 'vegetable' || /菜|青|白|萝卜|黄瓜|番茄/.test(food.name)) {
        return [
          { label: '小份', value: 100, desc: '≈ 一小碟' },
          { label: '一盘', value: 200, desc: '≈ 普通盘' },
          { label: '大份', value: 300, desc: '≈ 满盘' }
        ]
      }
      // 水果类
      if (category === 'fruit' || /果|瓜|莓|蕉|橙|梨|桃/.test(food.name)) {
        return [
          { label: '几块', value: 100, desc: '≈ 拳头大' },
          { label: '一个/份', value: 200, desc: '≈ 中等个' },
          { label: '大份', value: 350, desc: '≈ 一大碗' }
        ]
      }
      // 饮品
      if (category === 'drink' || /奶|茶|咖啡|汁|水/.test(food.name)) {
        return [
          { label: '小杯', value: 200, desc: '≈ 250ml' },
          { label: '中杯', value: 350, desc: '≈ 400ml' },
          { label: '大杯', value: 500, desc: '≈ 600ml' }
        ]
      }
      // 零食
      if (category === 'snack' || /饼|薯|糖|巧克力|坚果/.test(food.name)) {
        return [
          { label: '几口', value: 30, desc: '≈ 一小把' },
          { label: '一包', value: 60, desc: '≈ 正常包装' },
          { label: '大包', value: 100, desc: '≈ 分享装' }
        ]
      }
      // 通用默认
      return [
        { label: '少量', value: 50, desc: '≈ 小半碗' },
        { label: '一份', value: 150, desc: '≈ 普通份' },
        { label: '大份', value: 250, desc: '≈ 满满一份' }
      ]
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
      const grams = e.detail.value
      const food = this.properties.food
      const customKcal = grams ? Math.round(food.kcalPer100g * Number(grams) / 100) : 0
      this.setData({
        customGrams: grams,
        customKcal,
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
      const key = e.currentTarget.dataset.key
      const mealNameMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }
      this.setData({
        selectedMeal: key,
        selectedMealName: mealNameMap[key] || '午餐'
      })
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
