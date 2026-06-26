const { request } = require('../../utils/request')
const { getDefaultMeal, getMealName, formatDate } = require('../../utils/util')

Page({
  data: {
    todayStr: '',
    todayTotal: 0,
    dailyTarget: 1800,
    remaining: 1800,
    streak: 0,
    recentFoods: [],
    quickFoods: [],
    mealTemplates: [],
    meals: [
      { key: 'breakfast', name: '🌅 早餐', total: 0, records: [] },
      { key: 'lunch', name: '☀️ 午餐', total: 0, records: [] },
      { key: 'dinner', name: '🌙 晚餐', total: 0, records: [] },
      { key: 'snack', name: '🍪 加餐', total: 0, records: [] }
    ],
    showRecordModal: false,
    selectedFood: null
  },

  onLoad() {
    this.setData({
      todayStr: this.getDateStr()
    })
  },

  onShow() {
    this.loadTodayData()
    this.loadRecentFoods()
    this.loadUserTarget()
    this.loadQuickFoods()
    this.loadMealTemplates()
  },

  // 获取今日日期文字
  getDateStr() {
    const now = new Date()
    const weekMap = ['日', '一', '二', '三', '四', '五', '六']
    const month = now.getMonth() + 1
    const day = now.getDate()
    const week = weekMap[now.getDay()]
    return `${month}月${day}日 周${week}`
  },

  // 加载用户目标热量
  async loadUserTarget() {
    try {
      const res = await request('/user/profile', 'GET')
      if (res.code === 0 && res.data) {
        const target = res.data.dailyTarget || 1800
        this.setData({
          dailyTarget: target,
          remaining: target - this.data.todayTotal
        })
      }
    } catch (e) {
      console.log('loadUserTarget error:', e)
    }
  },

  // 加载今日记录
  async loadTodayData() {
    try {
      const today = formatDate(new Date())
      const res = await request(`/records?date=${today}`, 'GET')
      if (res.code === 0) {
        const records = res.data.records || []
        let todayTotal = 0
        const meals = [
          { key: 'breakfast', name: '🌅 早餐', total: 0, records: [] },
          { key: 'lunch', name: '☀️ 午餐', total: 0, records: [] },
          { key: 'dinner', name: '🌙 晚餐', total: 0, records: [] },
          { key: 'snack', name: '🍪 加餐', total: 0, records: [] }
        ]

        records.forEach(record => {
          todayTotal += record.kcal
          const mealIndex = meals.findIndex(m => m.key === record.meal)
          if (mealIndex > -1) {
            meals[mealIndex].records.push(record)
            meals[mealIndex].total += record.kcal
          }
        })

        this.setData({
          todayTotal,
          remaining: this.data.dailyTarget - todayTotal,
          meals,
          streak: res.data.streak || 0
        })
      }
    } catch (e) {
      console.log('loadTodayData error:', e)
    }
  },

  // 加载最近吃过的食物
  async loadRecentFoods() {
    try {
      const res = await request('/records/recent-foods', 'GET')
      if (res.code === 0) {
        this.setData({ recentFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadRecentFoods error:', e)
    }
  },

  // 加载快捷食物列表
  async loadQuickFoods() {
    try {
      const res = await request('/quick-foods', 'GET')
      if (res.code === 0) {
        this.setData({ quickFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadQuickFoods error:', e)
    }
  },

  // 加载餐食模板
  async loadMealTemplates() {
    try {
      const res = await request('/meal-templates', 'GET')
      if (res.code === 0) {
        this.setData({ mealTemplates: res.data || [] })
      }
    } catch (e) {
      console.log('loadMealTemplates error:', e)
    }
  },

  // 跳转搜索页
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  // ====== 快捷记录 ======
  // 点击快捷按钮直接记录
  async onQuickRecord(e) {
    const item = e.currentTarget.dataset.item
    const meal = getDefaultMeal() // 根据当前时间自动判断餐次

    try {
      const res = await request('/records', 'POST', {
        foodName: item.foodName,
        foodId: item.foodId || null,
        amount: item.amount,
        unit: item.unit,
        meal,
        kcal: item.kcal,
        date: formatDate(new Date())
      })
      if (res.code === 0) {
        wx.showToast({ title: `${item.name} ✓`, icon: 'success' })
        this.loadTodayData()
      }
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // 长按快捷按钮（删除/编辑）
  onQuickItemLongPress(e) {
    const item = e.currentTarget.dataset.item
    wx.showActionSheet({
      itemList: ['删除此快捷按钮'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/quick-foods/${item.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadQuickFoods()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 编辑快捷食物
  onEditQuickFoods() {
    wx.navigateTo({ url: '/pages/quick-foods/quick-foods' })
  },

  // ====== 餐食模板 ======
  // 使用模板一键记录
  async onUseTemplate(e) {
    const template = e.currentTarget.dataset.template
    const meal = template.defaultMeal || getDefaultMeal()

    wx.showModal({
      title: `记录「${template.name}」`,
      content: `包含${template.items.length}种食物，共${template.totalKcal}大卡\n记录到: ${getMealName(meal)}`,
      confirmText: '确认记录',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            // 先调用模板使用接口（增加使用次数）
            await request(`/meal-templates/${template.id}/use`, 'POST')
            
            // 批量记录
            const records = template.items.map(item => ({
              foodName: item.foodName,
              foodId: item.foodId || null,
              amount: item.amount,
              unit: item.unit,
              kcal: item.kcal,
              meal,
              date: formatDate(new Date())
            }))
            
            const res = await request('/records/batch', 'POST', { records })
            if (res.code === 0) {
              wx.showToast({ title: '记录成功', icon: 'success' })
              this.loadTodayData()
            }
          } catch (e) {
            wx.showToast({ title: '记录失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 管理模板
  goToTemplateManage() {
    wx.navigateTo({ url: '/pages/meal-templates/meal-templates' })
  },

  // 将某一餐保存为模板
  onSaveAsTemplate(e) {
    const meal = e.currentTarget.dataset.meal
    if (meal.records.length < 2) return

    wx.showModal({
      title: '保存为常吃模板',
      content: `将「${meal.name}」的${meal.records.length}项食物保存为模板，下次可一键记录`,
      editable: true,
      placeholderText: '模板名称（如：工作日午餐）',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const saveRes = await request('/meal-templates/from-records', 'POST', {
              name: res.content,
              meal: meal.key,
              records: meal.records
            })
            if (saveRes.code === 0) {
              wx.showToast({ title: '保存成功', icon: 'success' })
              this.loadMealTemplates()
            }
          } catch (e) {
            wx.showToast({ title: '保存失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ====== 最近吃过 / 记录弹窗 ======
  // 点击最近吃过的食物
  onRecentFoodTap(e) {
    const food = e.currentTarget.dataset.food
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // 记录确认
  async onRecordConfirm(e) {
    const { food, amount, unit, meal, kcal, sharePeople, shareRatio } = e.detail
    try {
      const res = await request('/records', 'POST', {
        foodName: food.name,
        foodId: food.id,
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
        this.loadTodayData()
      }
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // 关闭记录弹窗
  onRecordModalClose() {
    this.setData({ showRecordModal: false })
  },

  // 长按记录项（删除）
  onRecordLongPress(e) {
    const record = e.currentTarget.dataset.record
    wx.showActionSheet({
      itemList: ['删除此记录'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/records/${record.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
