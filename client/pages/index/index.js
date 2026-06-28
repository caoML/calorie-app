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
    selectedFood: null,
    monsterLevel: 0,
    // 飞数动效
    flyNumbers: [],
    flyNumberId: 0,
    // 怪兽喊饿 & 打卡激励
    monsterHungry: false,
    hungryMessage: '',
    // 营养均衡提示
    nutritionTip: null
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
    this.checkMonsterHungry()
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
        // 数据加载完毕后再检测喊饿 & 营养提示
        this.checkMonsterHungry()
        this.analyzeNutrition()
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
        this.showFlyNumber(item.kcal)
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
        this.setData({ showRecordModal: false })
        this.showFlyNumber(kcal)
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

  // 长按记录项（删除/清空）
  onRecordLongPress(e) {
    const record = e.currentTarget.dataset.record
    wx.showActionSheet({
      itemList: ['删除此记录', '清空今日全部记录'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/records/${record.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          this.clearTodayRecords()
        }
      }
    })
  },

  // 清空今日全部记录
  clearTodayRecords() {
    wx.showModal({
      title: '确认清空',
      content: '将删除今天的全部饮食记录，不可恢复',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 逐条删除今天的所有记录
            const allRecords = []
            this.data.meals.forEach(meal => {
              meal.records.forEach(r => allRecords.push(r))
            })
            await Promise.all(allRecords.map(r => request(`/records/${r.id}`, 'DELETE')))
            wx.showToast({ title: '已清空', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '清空失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ====== 左滑操作 ======
  onSwipeStart(e) {
    this._swipeStartX = e.touches[0].clientX
    this._swipeStartY = e.touches[0].clientY
    this._swiping = false
  },

  onSwipeMove(e) {
    const diffX = e.touches[0].clientX - this._swipeStartX
    const diffY = e.touches[0].clientY - this._swipeStartY

    // 如果纵向移动更多，不处理
    if (Math.abs(diffY) > Math.abs(diffX)) return

    if (diffX < -30) {
      this._swiping = true
      const recordId = e.currentTarget.dataset.recordId
      const mealKey = e.currentTarget.dataset.mealKey
      this._swipeRecordId = recordId
      this._swipeMealKey = mealKey
    }
  },

  onSwipeEnd(e) {
    if (!this._swiping) return
    this._swiping = false

    const recordId = this._swipeRecordId
    const mealKey = this._swipeMealKey

    // 标记该记录为已滑开状态
    const meals = this.data.meals.map(meal => {
      if (meal.key === mealKey) {
        return {
          ...meal,
          records: meal.records.map(r => ({
            ...r,
            _swiped: r.id === recordId ? !r._swiped : false
          }))
        }
      }
      return {
        ...meal,
        records: meal.records.map(r => ({ ...r, _swiped: false }))
      }
    })
    this.setData({ meals })
  },

  // 删除记录（左滑）
  async onDeleteRecord(e) {
    const record = e.currentTarget.dataset.record
    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.foodName}」？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
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
  },

  // 编辑记录（左滑）— 打开记录弹窗预填数据
  onEditRecord(e) {
    const record = e.currentTarget.dataset.record
    // 构造一个 food 对象传给 record-modal
    const food = {
      id: record.foodId,
      name: record.foodName,
      kcalPer100g: record.kcal, // 用于显示
      customKcal: record.kcal, // 直接使用原来的热量
      _editMode: true,
      _recordId: record.id,
      _originalRecord: record
    }
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // ====== 怪兽喊饿 & 打卡激励 ======
  // 检测是否该提醒用户记录
  checkMonsterHungry() {
    const hour = new Date().getHours()
    const meals = this.data.meals
    let monsterHungry = false
    let hungryMessage = ''

    // 早上10点后还没记早餐
    if (hour >= 10 && hour < 14) {
      const breakfast = meals.find(m => m.key === 'breakfast')
      if (breakfast && breakfast.records.length === 0) {
        monsterHungry = true
        hungryMessage = '早餐还没记呢，补一下吧~'
      }
    }
    // 下午14点后还没记午餐
    if (hour >= 14 && hour < 18) {
      const lunch = meals.find(m => m.key === 'lunch')
      if (lunch && lunch.records.length === 0) {
        monsterHungry = true
        hungryMessage = '午饭吃了吗？记一下吧~'
      }
    }
    // 晚上20点后还没记晚餐
    if (hour >= 20) {
      const dinner = meals.find(m => m.key === 'dinner')
      if (dinner && dinner.records.length === 0) {
        monsterHungry = true
        hungryMessage = '晚饭还没记录，别忘了哦~'
      }
    }
    // 今天完全没记录
    if (this.data.todayTotal === 0 && hour >= 12) {
      monsterHungry = true
      hungryMessage = '今天还没开始记录，快来喂我吧！'
    }

    this.setData({ monsterHungry, hungryMessage })
  },

  // ====== 营养均衡提示 ======
  analyzeNutrition() {
    const { meals, todayTotal, dailyTarget } = this.data
    const hour = new Date().getHours()

    // 至少记录了一餐才给建议
    const recordedMeals = meals.filter(m => m.records.length > 0)
    if (recordedMeals.length === 0 || todayTotal === 0) {
      this.setData({ nutritionTip: null })
      return
    }

    let tip = null

    // 分析各餐热量占比
    const breakfast = meals.find(m => m.key === 'breakfast')
    const lunch = meals.find(m => m.key === 'lunch')
    const dinner = meals.find(m => m.key === 'dinner')
    const snack = meals.find(m => m.key === 'snack')

    const bfKcal = breakfast ? breakfast.total : 0
    const lunchKcal = lunch ? lunch.total : 0
    const dinnerKcal = dinner ? dinner.total : 0
    const snackKcal = snack ? snack.total : 0

    // 1. 早餐太少（占比 < 15% 且已过中午）
    if (hour >= 12 && bfKcal > 0 && bfKcal < todayTotal * 0.15) {
      tip = {
        icon: '🥣',
        title: '早餐偏少',
        desc: '早餐建议占全天25-30%，明天可以适当丰富一下~'
      }
    }

    // 2. 晚餐占比过高（> 45%）
    if (!tip && hour >= 20 && dinnerKcal > todayTotal * 0.45) {
      tip = {
        icon: '🌙',
        title: '晚餐偏重',
        desc: '晚餐热量占比偏高，建议把部分热量分配到午餐'
      }
    }

    // 3. 加餐热量过高（> 25%）
    if (!tip && snackKcal > todayTotal * 0.25 && snackKcal > 300) {
      tip = {
        icon: '🍪',
        title: '零食稍多',
        desc: '加餐热量偏高，可以选择水果或坚果替代~'
      }
    }

    // 4. 某一餐热量集中（单餐 > 60%）
    if (!tip) {
      const maxMeal = [bfKcal, lunchKcal, dinnerKcal].reduce((a, b) => Math.max(a, b), 0)
      if (maxMeal > todayTotal * 0.6 && todayTotal > 500) {
        tip = {
          icon: '⚖️',
          title: '分配不均',
          desc: '单餐热量过高，建议三餐均衡分配（3:4:3）更健康'
        }
      }
    }

    // 5. 剩余预算紧张 but 还没吃晚餐
    if (!tip && hour < 18 && dinnerKcal === 0) {
      const remaining = dailyTarget - todayTotal
      if (remaining > 0 && remaining < dailyTarget * 0.25) {
        tip = {
          icon: '💡',
          title: '预算紧张',
          desc: `晚餐还剩 ${remaining} 大卡，建议选择轻食哦~`
        }
      }
    }

    // 6. 正向反馈 — 分配比较均衡
    if (!tip && recordedMeals.length >= 3) {
      const ratios = [bfKcal, lunchKcal, dinnerKcal].map(k => k / todayTotal)
      const balanced = ratios.every(r => r >= 0.2 && r <= 0.45)
      if (balanced) {
        tip = {
          icon: '✨',
          title: '均衡饮食',
          desc: '今天三餐分配不错，继续保持！'
        }
      }
    }

    this.setData({ nutritionTip: tip })
  },

  // 点击连续打卡徽章 - 展示打卡详情
  showStreakDetail() {
    const streak = this.data.streak
    let title = '🔥 连续打卡'
    let content = ''

    if (streak >= 30) {
      content = `太厉害了！连续记录${streak}天！\n你已经是自律达人了 💪`
    } else if (streak >= 14) {
      content = `坚持${streak}天了，很棒！\n继续保持，习惯已经养成 🎯`
    } else if (streak >= 7) {
      content = `连续${streak}天，一周达成！\n坚持就是胜利 ⭐`
    } else if (streak >= 3) {
      content = `已连续${streak}天，不错哦~\n再坚持几天养成习惯！`
    } else {
      content = `连续${streak}天，好的开始！\n每天记一记，轻松又健康~`
    }

    wx.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '继续加油'
    })
  },

  // ====== 飞数动效 ======
  // 显示热量飞数动画
  showFlyNumber(kcal) {
    const id = this.data.flyNumberId + 1
    const flyItem = { id, kcal: `+${kcal}`, animating: true }
    const flyNumbers = [...this.data.flyNumbers, flyItem]

    this.setData({ flyNumbers, flyNumberId: id })

    // 动画结束后移除
    setTimeout(() => {
      const updated = this.data.flyNumbers.filter(item => item.id !== id)
      this.setData({ flyNumbers: updated })
    }, 1200)
  },

  // ====== 怪兽交互 ======
  // 怪兽档位变化 → 背景联动
  onMonsterLevelChange(e) {
    const { level } = e.detail
    this.setData({ monsterLevel: level })
  },

  // 点击怪兽
  onMonsterTap() {
    const percent = this.data.dailyTarget > 0
      ? Math.round((this.data.todayTotal / this.data.dailyTarget) * 100)
      : 0

    // 随机回复一句
    const responses = this.getMonsterTapResponses(percent)
    const randomMsg = responses[Math.floor(Math.random() * responses.length)]

    wx.showToast({
      title: randomMsg,
      icon: 'none',
      duration: 2000
    })
  },

  // 根据当前状态获取点击怪兽的随机回复（上限模式：吃得少=开心）
  getMonsterTapResponses(percent) {
    if (percent < 20) {
      return ['今天状态满分！✨', '零负担，感觉超棒！', '继续保持轻盈~']
    }
    if (percent < 40) {
      return ['控制得真好！💪', '自律的人最帅了', '今天预算还很充裕~']
    }
    if (percent < 60) {
      return ['还不错，稳住~', '节奏刚刚好', '预算还很富裕呢']
    }
    if (percent < 80) {
      return ['正常正常，别有压力', '一天三餐都在计划内', '稳住就是胜利~']
    }
    if (percent < 95) {
      return ['预算快用完了，注意哦', '后面少吃点~', '快到上限了！']
    }
    if (percent <= 115) {
      return ['到上限了...管住嘴！', '超了一点，问题不大', '今天就到这里吧']
    }
    return ['我要炸了！！！', '今天放飞自我了...', '明天一定要补回来！']
  }
})
