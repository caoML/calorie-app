const { request } = require('../../utils/request')
const { kjToKcal, getDefaultMeal, formatDate } = require('../../utils/util')

Page({
  data: {
    keyword: '',
    results: [],
    userResults: [],
    systemResults: [],
    suggestions: [],
    searched: false,
    isKjInput: false,
    kjToKcalResult: 0,
    showRecordModal: false,
    selectedFood: null,
    // AI 估算
    aiLoading: false,
    aiResult: null,
    // 手动添加
    showManualModal: false,
    manualForm: {
      name: '',
      kcalPer100g: '',
      category: 'dish'
    },
    foodCategories: [
      { key: 'staple', name: '主食' },
      { key: 'meat', name: '肉蛋' },
      { key: 'vegetable', name: '蔬菜' },
      { key: 'fruit', name: '水果' },
      { key: 'drink', name: '饮品' },
      { key: 'snack', name: '零食' },
      { key: 'dish', name: '菜肴' }
    ],
    categories: [
      { key: 'staple', name: '主食' },
      { key: 'meat', name: '肉蛋' },
      { key: 'vegetable', name: '蔬菜' },
      { key: 'fruit', name: '水果' },
      { key: 'drink', name: '饮品' },
      { key: 'snack', name: '零食' }
    ],
    activeCategory: 'staple',
    categoryFoods: [],
    // 智能推荐
    mealTimeLabel: '',
    smartRecommends: [],
    // 组合记录模式（本餐清单）
    comboMode: false,
    comboList: [],
    comboTotalKcal: 0
  },

  onLoad() {
    this.loadCategoryFoods('staple')
    this.loadSmartRecommends()
  },

  // 智能时段推荐：根据当前时间+历史记录推荐常吃食物
  async loadSmartRecommends() {
    const hour = new Date().getHours()
    let mealTimeLabel = ''
    let meal = ''

    if (hour >= 5 && hour < 10) {
      mealTimeLabel = '☀️ 早餐时间，猜你想记'
      meal = 'breakfast'
    } else if (hour >= 10 && hour < 14) {
      mealTimeLabel = '🍱 午餐时间，猜你想记'
      meal = 'lunch'
    } else if (hour >= 16 && hour < 20) {
      mealTimeLabel = '🌙 晚餐时间，猜你想记'
      meal = 'dinner'
    } else if (hour >= 14 && hour < 16) {
      mealTimeLabel = '🍪 下午茶时间，猜你想记'
      meal = 'snack'
    } else {
      mealTimeLabel = '⏱ 根据你的习惯推荐'
      meal = ''
    }

    this.setData({ mealTimeLabel })

    try {
      const url = meal 
        ? `/records/smart-recommend?meal=${meal}` 
        : '/records/smart-recommend'
      const res = await request(url, 'GET')
      if (res.code === 0 && res.data && res.data.length > 0) {
        this.setData({ smartRecommends: res.data.slice(0, 6) })
      }
    } catch (e) {
      console.log('loadSmartRecommends error:', e)
    }
  },

  // 点击推荐食物
  onRecommendTap(e) {
    const food = e.currentTarget.dataset.food
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // 输入事件
  onInput(e) {
    const keyword = e.detail.value.trim()
    this.setData({ keyword, aiResult: null })

    // 判断是否为纯数字（kJ输入）
    if (/^\d+(\.\d+)?$/.test(keyword) && Number(keyword) > 0) {
      this.setData({
        isKjInput: true,
        kjToKcalResult: kjToKcal(Number(keyword)),
        results: [],
        userResults: [],
        systemResults: [],
        suggestions: [],
        searched: false
      })
    } else {
      this.setData({ isKjInput: false })
      // 搜索食物（防抖）
      if (keyword.length >= 1) {
        this.debounceSearch(keyword)
      } else {
        this.setData({ results: [], userResults: [], systemResults: [], suggestions: [], searched: false })
      }
    }
  },

  // 防抖搜索
  debounceSearch(keyword) {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this.searchFood(keyword)
    }, 300)
  },

  // 搜索食物（联合搜索公共库+私人库）
  async searchFood(keyword) {
    try {
      const res = await request(`/foods/search?keyword=${encodeURIComponent(keyword)}`, 'GET')
      if (res.code === 0) {
        const allResults = res.data || []
        const userResults = allResults.filter(f => f.isUserFood)
        const systemResults = allResults.filter(f => !f.isUserFood)

        // 判断是否有精确匹配（结果中有和关键词完全一样的食物名）
        const hasExactMatch = allResults.some(f => f.name === keyword)

        this.setData({
          results: allResults,
          userResults,
          systemResults,
          suggestions: res.suggestions || [],
          searched: true,
          hasExactMatch
        })
      }
    } catch (e) {
      console.log('searchFood error:', e)
    }
  },

  // 确认搜索
  onSearch() {
    if (this.data.keyword) {
      this.searchFood(this.data.keyword)
    }
  },

  // 清空关键词
  clearKeyword() {
    this.setData({
      keyword: '',
      results: [],
      userResults: [],
      systemResults: [],
      suggestions: [],
      searched: false,
      hasExactMatch: false,
      isKjInput: false,
      aiResult: null,
      aiLoading: false
    })
  },

  // kJ 直接记录
  onKjRecord() {
    const kcal = this.data.kjToKcalResult
    this.setData({
      selectedFood: {
        name: '自定义食物',
        kcalPer100g: kcal,
        customKcal: kcal
      },
      showRecordModal: true
    })
  },

  // 点击搜索结果
  onResultTap(e) {
    const food = e.currentTarget.dataset.food
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // ===== AI 估算 =====
  async onAiEstimate() {
    const keyword = this.data.keyword
    if (!keyword) return

    this.setData({ aiLoading: true, aiResult: null })

    try {
      const res = await request('/ai-estimate', 'POST', { foodName: keyword })
      if (res.code === 0) {
        const result = res.data
        // 给 servings 计算具体热量
        if (result.servings) {
          result.servings = result.servings.map(s => ({
            ...s,
            kcal: Math.round(result.kcalPer100g * s.grams / 100)
          }))
        }
        this.setData({ aiResult: result, aiLoading: false })
      } else {
        wx.showToast({ title: res.message || '估算失败', icon: 'none' })
        this.setData({ aiLoading: false })
      }
    } catch (err) {
      console.error('AI estimate error:', err)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
      this.setData({ aiLoading: false })
    }
  },

  // 使用 AI 估算结果记录
  onUseAiResult() {
    const aiResult = this.data.aiResult
    if (!aiResult) return

    // 立即弹框，不等网络请求
    this.setData({
      selectedFood: {
        ...aiResult,
        isUserFood: true,
        source: 'ai'
      },
      showRecordModal: true
    })

    // 后台静默保存到私人库（不阻塞用户操作）
    this.saveAiResultToLibrary(aiResult)
  },

  async saveAiResultToLibrary(aiResult) {
    try {
      const res = await request('/ai-estimate/save', 'POST', { foodName: aiResult.name })
      if (res.code === 0) {
        // 保存成功，更新 selectedFood 为服务端返回的完整数据
        const food = res.data
        food.servings = aiResult.servings
        this.setData({ selectedFood: food })
      }
    } catch (err) {
      // 保存失败也不影响，已经用本地数据弹框了
      console.warn('AI result save to library failed:', err)
    }
  },

  // 编辑 AI 结果（跳转到手动添加，预填数据）
  onEditAiResult() {
    const aiResult = this.data.aiResult
    this.setData({
      showManualModal: true,
      manualForm: {
        name: aiResult.name,
        kcalPer100g: String(aiResult.kcalPer100g),
        category: aiResult.category || 'dish'
      }
    })
  },

  // ===== 手动添加 =====
  onManualAdd() {
    this.setData({
      showManualModal: true,
      manualForm: {
        name: this.data.keyword,
        kcalPer100g: '',
        category: 'dish'
      }
    })
  },

  onManualName(e) {
    this.setData({ 'manualForm.name': e.detail.value })
  },

  onManualKcal(e) {
    this.setData({ 'manualForm.kcalPer100g': e.detail.value })
  },

  onManualCategory(e) {
    this.setData({ 'manualForm.category': e.currentTarget.dataset.key })
  },

  closeManualModal() {
    this.setData({ showManualModal: false })
  },

  // 保存手动添加的食物并记录
  async saveManualFood() {
    const { name, kcalPer100g, category } = this.data.manualForm

    if (!name) {
      wx.showToast({ title: '请输入食物名称', icon: 'none' })
      return
    }
    if (!kcalPer100g || Number(kcalPer100g) <= 0) {
      wx.showToast({ title: '请输入有效的热量值', icon: 'none' })
      return
    }

    try {
      // 保存到私人食物库
      const res = await request('/user-foods', 'POST', {
        name,
        kcalPer100g: Number(kcalPer100g),
        category,
        source: 'user',
        servings: JSON.stringify([
          { label: '小份(约200g)', grams: 200 },
          { label: '中份(约300g)', grams: 300 },
          { label: '大份(约400g)', grams: 400 }
        ])
      })

      if (res.code === 0) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ showManualModal: false })

        // 打开记录弹窗
        const food = res.data
        food.servings = [
          { label: '小份(约200g)', grams: 200 },
          { label: '中份(约300g)', grams: 300 },
          { label: '大份(约400g)', grams: 400 }
        ]
        food.isUserFood = true

        setTimeout(() => {
          this.setData({
            selectedFood: food,
            showRecordModal: true
          })
        }, 500)
      }
    } catch (err) {
      console.error('save manual food error:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 分类点击
  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeCategory: key })
    this.loadCategoryFoods(key)
  },

  // 加载分类食物
  async loadCategoryFoods(category) {
    try {
      const res = await request(`/foods/category?category=${category}`, 'GET')
      if (res.code === 0) {
        this.setData({ categoryFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadCategoryFoods error:', e)
    }
  },

  // 记录确认
  async onRecordConfirm(e) {
    const { food, amount, unit, meal, kcal, sharePeople, shareRatio } = e.detail

    // 组合模式：添加到本餐清单
    if (this.data.comboMode) {
      const comboItem = {
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        foodName: food.name,
        foodId: food.id || null,
        amount,
        unit,
        kcal,
        sharePeople: sharePeople || 1,
        shareRatio: shareRatio || 'equal'
      }
      const comboList = [...this.data.comboList, comboItem]
      const comboTotalKcal = comboList.reduce((sum, item) => sum + item.kcal, 0)

      this.setData({
        showRecordModal: false,
        comboList,
        comboTotalKcal
      })
      wx.showToast({ title: `已添加·共${comboList.length}项`, icon: 'none', duration: 1000 })

      // 如果是用户私人食物，增加使用计数
      if (food.isUserFood && food.id) {
        request(`/user-foods/${food.id}`, 'PUT', { useCount: (food.useCount || 0) + 1 }).catch(() => {})
      }
      return
    }

    // 普通模式：直接提交
    try {
      const res = await request('/records', 'POST', {
        foodName: food.name,
        foodId: food.id || null,
        amount,
        unit,
        meal: meal || getDefaultMeal(),
        kcal,
        sharePeople: sharePeople || 1,
        shareRatio: shareRatio || 'equal',
        date: formatDate(new Date())
      })
      if (res.code === 0) {
        wx.showToast({ title: '记录成功', icon: 'success' })
        this.setData({ showRecordModal: false })

        // 如果是用户私人食物，增加使用计数
        if (food.isUserFood && food.id) {
          request(`/user-foods/${food.id}`, 'PUT', { useCount: (food.useCount || 0) + 1 }).catch(() => {})
        }

        // 返回首页刷新
        setTimeout(() => {
          wx.navigateBack()
        }, 800)
      }
    } catch (err) {
      console.error('❌ 记录失败:', err)
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // ====== 组合记录模式 ======
  // 切换组合模式
  toggleComboMode() {
    const comboMode = !this.data.comboMode
    this.setData({ comboMode })
    if (comboMode) {
      wx.showToast({ title: '组合模式·连续添加', icon: 'none', duration: 1500 })
    }
  },

  // 从清单中删除某项
  removeComboItem(e) {
    const id = e.currentTarget.dataset.id
    const comboList = this.data.comboList.filter(item => item.id !== id)
    const comboTotalKcal = comboList.reduce((sum, item) => sum + item.kcal, 0)
    this.setData({ comboList, comboTotalKcal })
  },

  // 一键提交整个清单
  async submitComboList() {
    const { comboList } = this.data
    if (comboList.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }

    const meal = getDefaultMeal()
    const records = comboList.map(item => ({
      foodName: item.foodName,
      foodId: item.foodId,
      amount: item.amount,
      unit: item.unit,
      kcal: item.kcal,
      meal,
      sharePeople: item.sharePeople || 1,
      shareRatio: item.shareRatio || 'equal',
      date: formatDate(new Date())
    }))

    try {
      const res = await request('/records/batch', 'POST', { records })
      if (res.code === 0) {
        wx.showToast({ title: `${comboList.length}项全部记录成功！`, icon: 'success' })
        this.setData({ comboList: [], comboTotalKcal: 0, comboMode: false })
        setTimeout(() => {
          wx.navigateBack()
        }, 1000)
      }
    } catch (err) {
      console.error('submitComboList error:', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  // 清空本餐清单
  clearComboList() {
    wx.showModal({
      title: '清空本餐清单',
      content: `确定清空已添加的${this.data.comboList.length}项食物？`,
      success: (res) => {
        if (res.confirm) {
          this.setData({ comboList: [], comboTotalKcal: 0 })
        }
      }
    })
  },

  // 关闭弹窗
  onRecordModalClose() {
    this.setData({ showRecordModal: false })
  },

  preventBubble() {},
  preventMove() {}
})
