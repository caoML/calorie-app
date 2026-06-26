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
    categoryFoods: []
  },

  onLoad() {
    this.loadCategoryFoods('staple')
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

        this.setData({
          results: allResults,
          userResults,
          systemResults,
          suggestions: res.suggestions || [],
          searched: true
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

    // 先保存到私人库，再打开记录弹窗
    this.saveAiResultAndRecord(aiResult)
  },

  async saveAiResultAndRecord(aiResult) {
    try {
      const res = await request('/ai-estimate/save', 'POST', { foodName: aiResult.name })
      if (res.code === 0) {
        const food = res.data
        food.servings = aiResult.servings
        this.setData({
          selectedFood: food,
          showRecordModal: true
        })
      }
    } catch (err) {
      // 降级：直接用估算结果记录
      this.setData({
        selectedFood: {
          ...aiResult,
          isUserFood: true,
          source: 'ai'
        },
        showRecordModal: true
      })
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

  // 关闭弹窗
  onRecordModalClose() {
    this.setData({ showRecordModal: false })
  },

  preventBubble() {},
  preventMove() {}
})
